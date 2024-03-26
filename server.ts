import "dotenv/config";
import debug from "debug";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs/promises";
import path from "path";
import { Worker } from "worker_threads";
import { v4 as uuidv4 } from "uuid";
import type {
  ClientActions,
  FileData,
  ServerActions
} from "./types";

const log = debug("pdk:server");

try {
  await fs.access(path.join(import.meta.dirname, "uploads"));
} catch (err) {
  await fs.mkdir(path.join(import.meta.dirname, "uploads"));
}

const app = express();
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let lastFileName: string;
	ws.on("message", async (message) => {
    let actionData: ServerActions | undefined;
    let buffer: Buffer | undefined;
    try {
      actionData = JSON.parse(message.toString()) as ServerActions;
    } catch {
      buffer = message as Buffer;
    }

		if (actionData) {
			// Handle JSON messages
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
			// Handle binary data (the file itself)
      const fileName = lastFileName;
			const uniqueName = uuidv4(); // Generate a unique filename

			try {
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
              error: err?.message || err
						} as ClientActions),
					);
				});

				worker.on("exit", (code) => {
					if (code !== 0)
						console.error(`Worker stopped with exit code ${code}`);
				});
			} catch (err: any) {
				console.error("Failed to save the file:", err);
				ws.send(
					JSON.stringify({
						action: "ERROR",
						fileName,
						error: err?.message || err,
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
