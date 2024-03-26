// Pull in dotenv package to load environment variables from a .env file
import "dotenv/config";
import debug from "debug";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs/promises";
import path from "path";
import { Worker } from "worker_threads";
import { v4 as uuidv4 } from "uuid";
// Import the types we defined in the types.ts file to keep them organized.
import type {
  ClientActions,
  FileData,
  ServerActions
} from "./types";

// We use the debug module to print more detailed logs that are easy to disable in production.
const log = debug("pdk:server");

// Ensure that the uploads/ directory exists to avoid errors when saving files.
// You'll also notice we are using top-level await in this project :D
try {
  await fs.access(path.join(import.meta.dirname, "uploads"));
} catch (err) {
  await fs.mkdir(path.join(import.meta.dirname, "uploads"));
}

const app = express();
// We need to create our own server instance so we can attach both express and the WebSocket server to it.
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
	// Remember the file name passed in via the metadata payload.
	// This need only be remembered for the subsequent binary message over the socket.
	// The client code ensures these messages arrive in the correct order regardless of file read time.
  let lastFileName: string;
	ws.on("message", async (message) => {
    let actionData: ServerActions | undefined;
    let buffer: Buffer | undefined;
		// Try to parse the payload as a JSON string and fall back to a Buffer if it fails.
    try {
      actionData = JSON.parse(message.toString()) as ServerActions;
    } catch {
      buffer = message as Buffer;
    }

		// If it was a JSON message then it will contain an action and arguments.
		if (actionData) {
			const { action } = actionData;
      switch (action) {
        case "INIT_UPLOAD":
          const { fileName, fileSize } = actionData;
          lastFileName = fileName;
          log(`Preparing to receive file: ${fileName}`);
          // Acknowledge the file upload initiation
          ws.send(JSON.stringify({
            action: "STATUS_UPDATE",
            fileName,
            fileSize,
            status: "File upload initiated",
            progress: 0
          } as ClientActions));
          break;
        // Add more actions here
      }
		} else if (buffer) {
			// Handle binary data for the file itself
      const fileName = lastFileName;
			// Generate a unique filename so users don't overwrite each other's files in temporary upload storage.
			const uniqueName = uuidv4(); 

			try {
				// Write the file to temporary storage so it can be retrieved later by the worker thread.
				await fs.writeFile(path.join(import.meta.dirname, "uploads", uniqueName), buffer);
				log(`File received and saved: ${uniqueName}`);

				// Acknowledge the file upload completion
				ws.send(
					JSON.stringify({
            action: "STATUS_UPDATE",
            fileName,
            status: "File upload completed",
            progress: 100
          } as ClientActions),
				);

				// Send the file for processing
				const worker = new Worker(
					path.join(import.meta.dirname, "fileProcessor.js"),
					{
						workerData: { fileName, uniqueName } as FileData,
					},
				);

				worker.on("message", (message) => {
					// Send processing results back to the client
					ws.send(JSON.stringify(message));
				});

				worker.on("error", (err) => {
					console.error(`Worker error: ${err}`);
					ws.send(
						JSON.stringify({
							action: "STATUS_UPDATE",
							fileName,
              status: err?.message || err
						} as ClientActions),
					);
				});

				worker.on("exit", (code) => {
					if (code !== 0) {
						console.error(`Worker stopped with exit code ${code}`);
						// TODO: cleanup temporary files
					}
				});
			} catch (err: any) {
				console.error("Failed to save the file:", err);
				ws.send(
					JSON.stringify({
						action: "STATUS_UPDATE",
						fileName,
						status: err?.message || err,
					}),
				);
			}
		}
	});
});

// Define static route for serving the HTML file
app.get("/", (req, res) => {
	res.sendFile(path.join(import.meta.dirname, "index.html"));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
