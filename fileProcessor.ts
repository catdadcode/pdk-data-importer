import { workerData, parentPort } from "worker_threads";
import { Readable } from "stream";
import csvParser from "csv-parser";
import xlsx from "xlsx";
import { PrismaClient, CredentialType } from "@prisma/client";
import fs from "fs/promises";
import { setTimeout } from "timers/promises";
import path from "path";
import { FileData, Row, ClientActions, ProcessResult } from "./types";
import debug from "debug";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);
const dnsResolveMx = promisify(dns.resolveMx);

const prisma = new PrismaClient();

// Retrieve all stored disposable domains and keep in memory to use for validation later.
const disposableDomains = await prisma.disposableDomain.findMany();

const { fileName, uniqueName } = workerData as FileData;
const log = debug(`pdk:fileProcessor:${uniqueName}`);
const buffer = await fs.readFile(
	path.join(import.meta.dirname, "uploads", uniqueName),
);
await processFile(buffer, fileName);

function parseCSV(fileBuffer: Buffer): Promise<Row[]> {
	return new Promise((resolve, reject) => {
		const results: Row[] = [];
		const readableStream = new Readable();
		readableStream.push(fileBuffer);
		readableStream.push(null);
		readableStream
			.pipe(csvParser())
			.on("data", (data) => results.push(data))
			.on("end", () => resolve(results))
			.on("error", (error) => reject(error));
	});
}

function parseXLSX(fileBuffer: Buffer): Row[] {
	const workbook = xlsx.read(fileBuffer, { type: "buffer" });
	const sheetName = workbook.SheetNames[0];
	const sheet = workbook.Sheets[sheetName];
	return xlsx.utils.sheet_to_json(sheet);
}

async function processRow(fileName: string, row: Row): Promise<ProcessResult> {
	// Artificially simulate a longer processing time so we can see the progress bar in action.
	await setTimeout(1000);
	try {
		// First we try to validate the row data before we attempt any CRUD operations.
		await validateRow(fileName, row);
	} catch (err: any) {
		parentPort!.postMessage({
			action: "STATUS_UPDATE",
			fileName,
			status: err.message,
		} as ClientActions);
		return {
			status: "ERROR",
			error: err.message
		};
	}

	// Keep track of whether this row is a new record or an update to an existing record.
	let status: ProcessResult["status"];
	// Keep track of how many mobile/bluetooth credential invites we need to send.
	let invites = 0;

	const {
		personId,
		first,
		last,
		cards,
		groups,
		email,
		bluetooth,
		mobile,
		enabled,
		pin,
		pinDuress,
		activeDate,
		expireDate
	} = row;

	// Attempt to find an existing person.
	let person = await prisma.person.findFirst({
		include: {
			credentials: true,
			groupMemberships: true
		},
		where: {
			OR: [
				{ id: personId },
				{ email },
			]
		}
	});

	// If no person exists yet then attempt to create a new one.
	if (!person) {
		status = "CREATE";
		person = await prisma.person.create({
			include: {
				credentials: true,
				groupMemberships: true
			},
			data: {
				id: personId,
				first,
				last,
				email,
				enabled: Boolean(enabled),
				pin,
				pinDuress,
				activeDate: new Date(activeDate),
				expireDate: new Date(expireDate)
			},
		});
	} else {
		status = "UPDATE";
		Object.assign(person, {
			first,
			last,
			email,
			enabled: Boolean(enabled),
			activeDate: new Date(activeDate),
			expireDate: new Date(expireDate),
			pin,
			pinDuress
		});
	}

	// Filter all "custom.*" fields on row and add them to a metadata json object.
	const metadata: Record<string, any> = Object.entries(row)
		.filter(([key]) => key.startsWith("custom."))
		.reduce((acc, [key, value]) => {
			acc[key.replace("custom.", "")] = value;
			return acc;
		}, {} as Record<string, any>);
	// Merge new metadata with existing metadata.
	person.metadata = Object.assign({}, person.metadata, metadata);

	// Create card credentials.
	for (const card of cards.toString().split(",")) {
		let credential = person.credentials.find(c => c.type === CredentialType.CARD && c.value === card);
		if (!credential) {
			credential = await prisma.credential.create({
				include: {
					person: true
				},
				data: {
					value: card,
					type: CredentialType.CARD,
					personId: person.id
				}
			});
		}
	}

	// Create or delete bluetooth credentials.
	const btCredentials = person.credentials.filter(c => c.type === CredentialType.BLUETOOTH);
	if (bluetooth === 0) {
		await prisma.credential.deleteMany({
			where: {
				id: {
					in: btCredentials.map(c => c.id)
				}
			}
		});
	} else if (btCredentials.length < bluetooth) {
		for (let index = 0; index < bluetooth - btCredentials.length; index++) {
			await prisma.credential.create({
				include: {
					person: true
				},
				data: {
					type: CredentialType.BLUETOOTH,
					personId: person.id
				}
			});
			invites++;
		}
	}

	// Create or delete mobile credentials.
	const mobileCredentials = person.credentials.filter(c => c.type === CredentialType.MOBILE);
	if (mobile === 0) {
		await prisma.credential.deleteMany({
			where: {
				id: {
					in: mobileCredentials.map(c => c.id)
				}
			}
		});
	} else if (mobileCredentials.length < mobile) {
		for (let index = 0; index < mobile - mobileCredentials.length; index++) {
			await prisma.credential.create({
				include: {
					person: true
				},
				data: {
					type: CredentialType.MOBILE,
					personId: person.id
				}
			});
			invites++;
		}
	}

	// Create or delete group memberships.
	const groupNames = groups.toString().split(",");
	const existingGroups = await prisma.group.findMany({
		where: {
			name: {
				in: groupNames
			}
		}
	});
	// Find groupNames that don't yet exist and create them.
	const newGroups = groupNames.filter(gn => !existingGroups.some(g => g.name === gn));
	for (const groupName of newGroups) {
		const newGroup = await prisma.group.create({
			data: {
				name: groupName
			}
		});
		await prisma.groupMembership.create({
			data: {
				groupId: newGroup.id,
				personId: person.id
			}
		});
	}

	log(fileName, row, status, invites);
	return { status, invites };
}

async function validateRow(fileName: string, row: Row): Promise<void> {
	const errors: string[] = [];
	const {
		first,
		last,
		email,
		bluetooth,
		mobile,
		pin,
		pinDuress,
	} = row;

	// Validate First and Last Name
	if (
		!first ||
		first.length > 50 ||
		!last ||
		last.length > 50
	) {
		errors.push("Invalid first or last name.");
	}

	// Validate Email
	// TODO: Use a robust validation library for advanced validation.
	if (email && !/^\S+@\S+\.\S+$/.test(email)) {
		errors.push("Invalid email address.");
	}
	const [localPart, domainPart] = email.split('@');
	if (!domainPart) {
			errors.push("Invalid email format.");
	} else {
		// Reject disposable domains
		if (disposableDomains.some(dd => dd.domain.toLowerCase() === domainPart.toLowerCase())) {
				errors.push("Disposable email addresses are not allowed.");
		}
		try {
				// Check for DNS record
				await dnsLookup(domainPart);

				// Check for MX record
				const mxRecords = await dnsResolveMx(domainPart);
				if (mxRecords.length === 0) {
						errors.push("No MX records found.");
				}
		} catch (err: any) {
				if (err.code === 'ENOTFOUND') {
						errors.push("Domain does not exist.");
				} else {
						errors.push("Failed to verify email domain.");
				}
		}
	}

	// TODO: Use a third party service for invalid recipient detection.

	// Validate Pin and Duress Pin with BigInt
	if (
		(pin && BigInt(pin) > 9999999999n) ||
		(pinDuress && BigInt(pinDuress) > 9999999999n)
	) {
		errors.push("Pin or duress pin exceeds maximum value.");
	}

	// Validate Bluetooth and Mobile credentials
	if (
		(!email && bluetooth && bluetooth > 0) ||
		(!email && mobile && mobile > 0)
	) {
		errors.push(
			"Bluetooth or mobile credential specified without an email address.",
		);
	}

	// Find person by first and last name.
	const existingPerson = await prisma.person.findFirst({
		where: {
			first,
			last,
		},
	});
	// Persons with the same name are considered a conflict.
	if (existingPerson) {
		errors.push(`Person with the name ${first} ${last} already exists.`);
	}

	// Gather all validation errors and throw as one error.
	if (errors.length > 0) {
		throw new Error(
			`Validation error in file ${fileName}: ${errors.join(", ")}`,
		);
	}
}

async function processFile(
	fileBuffer: Buffer,
	fileName: string,
): Promise<void> {
	const extension = fileName.split(".").pop();
	switch (extension) {
		case "csv":
			try {
				const rows = await parseCSV(fileBuffer);
				if (rows.length > 10000) {
					throw new Error(
						"File contains too many entries. The maximum allowed is 10,000.",
					);
				}
				const results = await Promise.all(
					rows.map((row, index) => {
						parentPort!.postMessage({
							action: "STATUS_UPDATE",
							fileName,
							status: "Processing...",
							progress: ((index + 1) / rows.length) * 100,
						} as ClientActions);
						return processRow(fileName, row);
					}),
				);
				const errors = results.filter((r) => r.status === "ERROR");
				if (errors.length > 0) {
					throw new Error(
						`File contains errors. Please fix them and try again.\n${errors
							.map((e) => {
								if (e.status === "ERROR") {
									return e.error;
								}
							})
							.join("\n")}`,
					);
				}
				parentPort!.postMessage({
					action: "STATUS_UPDATE",
					fileName,
					status: "Done!",
					report: {
						recordsCreated: results.filter((r) => r.status === "CREATE").length,
						recordsUpdated: results.filter((r) => r.status === "UPDATE").length,
						credentialCount: results.reduce((acc, r) => {
							if (r.status !== "ERROR") {
								return acc + r.invites
							}
							return acc;
						}, 0)
					},
				} as ClientActions);
			} catch (err: any) {
				parentPort!.postMessage({
					action: "STATUS_UPDATE",
					fileName,
					status: err?.message || "Unknown error",
				} as ClientActions);
			}
			break;
		case "xlsx":
			try {
				const rows = parseXLSX(fileBuffer);
				if (rows.length > 10000) {
					throw new Error(
						"File contains too many entries. The maximum allowed is 10,000.",
					);
				}
				const results = await Promise.all(
					rows.map((row, index) => {
						parentPort!.postMessage({
							action: "STATUS_UPDATE",
							fileName,
							status: "Processing...",
							progress: ((index + 1) / rows.length) * 100,
						} as ClientActions);
						return processRow(fileName, row);
					}),
				);
				const errors = results.filter((r) => r.status === "ERROR");
				if (errors.length > 0) {
					throw new Error(
						`File contains errors. Please fix them and try again.\n${errors
							.map((e) => {
								if (e.status === "ERROR") {
									return e.error;
								}
							})
							.join("\n")}`,
					);
				}
				parentPort!.postMessage({
					action: "STATUS_UPDATE",
					fileName,
					status: "Done!",
					report: {
						recordsCreated: results.filter((r) => r.status === "CREATE").length,
						recordsUpdated: results.filter((r) => r.status === "UPDATE").length,
						credentialCount: results.reduce((acc, r) => {
							if (r.status !== "ERROR") {
								return acc + r.invites
							}
							return acc;
						}, 0)
					}
				} as ClientActions);
			} catch (err: any) {
				parentPort!.postMessage({
					action: "STATUS_UPDATE",
					fileName,
					status: err?.message || "Unknown error",
				} as ClientActions);
			}
			break;
		default:
			parentPort!.postMessage({
				action: "STATUS_UPDATE",
				fileName,
				status: "Unsupported file format.",
			} as ClientActions);
	}
}