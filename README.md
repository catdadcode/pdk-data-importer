# Super Cool File Uploader
![](readme-img.png)

## Description
This project was created as part of a technical assessment for a job application. The task involved allowing a user to upload multiple files to an http server. The server would then store the files temporarily and kick off a separate worker thread to begin validating and processing the data files. The results are stored to a Postgres database.

## Quick Start

> Docker is a prerequisite to running this project. Please ensure you have [Docker](https://docker.com) installed before proceeding.

1. `git clone git@github.com:catdadcode/pdk-data-importer.git && cd pdk-data-importer`

2. `docker compose up`

That's it! The project should now be running on `http://localhost:3000`.

## Technologies Used
- Node.js
- TypeScript
- Express
- Postgres
- Docker
- TailwindCSS
- WebSockets
- Worker threads
- Prisma ORM

### Node.js + TypeScript
I spoke about my love for Bun but node is still the de facto standard and is used at PDK so I decided to stick with the tried and true method. However it is fun to note that Bun would have slimmed down a fair bit of boilerplate ;)

### Express
Express, in my opinion, may as well just have it's functionality rolled into node at this point 😂. It's so ubiquitous for anything REST related. I started off using it with the [Multer](https://www.npmjs.com/package/multer) middleware for uploading, but since I was already using WebSockets for realtime updates I decided it made sense to just establish a single pipe and use it for everything. Which basically means express is only used to serve the `index.html` file. A simple `http` server would do for that but I left express in there since it was already setup and would have been there had I needed it for anything else.

### Prisma ORM + Postgres
I wanted to show that I'm familiar with ORMs so I picked my favorite one, Prisma. Setting up a schema that can be easily updated and migrated without losing data is extremely useful and Prisma makes that super easy.

### Docker
I love Docker. It's so easy to setup and run a project in a container. It's also a great way to ensure that the project is running in the same environment as the one it was developed in. I've included a `compose.yml` file that will setup the project with a Postgres database and a Node.js server. For local development I simply mapped `postgres        127.0.0.1` in `/etc/hosts` within WSL and then run `docker compose up postgres` to only spin up the database container. This way I could run the app outside of Docker without modifying the connection string during development. When running `docker compose up` the app itself will also be containerized and utilize docker's default networking to connect to the database container.

### Worker Threads
One of the requirements stated that the file processing needed to be done in a separate process. It can actually be detrimental to spin up whole processes for simple tasks like this so I opted to use worker threads instead, which accomplish the same goal of ensuring the work done there doesn't not bog down the main event loop. A new worker thread is spun up for each file uploaded and is responsible for all file validation and processing. Updates are communicated back to the main thread and sent immediately to the client over the already established WebSocket connection.

### WebSockets
Since we needed to communicate back to the client with status updates it made sense to just go straight to a proper WebSocket. This we we have bidirectional communication for all of our needs. One unique challenge here is that there is no simple way to send metadata with a binary WebSocket message. This means that we have to send a JSON payload ahead of the binary data and ensure that we can associate those two messages together on the server without any race conditions due to additional uploads or other connected clients.

On the server side I had to establish a `lastFileName` variable at the socket connection level so the file name could be remembered by the time we receive the binary payload. However this is only half a solution as multiple metadata payloads will override this value. We have to also ensure that the messages are sent in the correct order. To do this the client script wraps both messages in a promise and waits for that promise to resolve before sending the next one.

### TailwindCSS
When I first looked at Tailwind I hated it. I thought it made markup messy looking. But after using it regularly I won't do CSS any other way if I have a choice. It's so fast to iterate with, especially for stuff like this where I'm not taking the time to setup a full blown front-end build pipeline. Just drop it in via CDN and you're off the the races!