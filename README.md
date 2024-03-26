# Super Cool File Uploader
![](readme-img.png)

## Description
This project was created as part of a technical assessment for a job application. The task involved allowing a user to upload multiple files to an http server. The server would then store the files temporarily and kick off a separate worker thread to begin validating and processing the data files. The results are stored to a Postgres database.

## Quick Start

> Docker is a prerequisite to running this project. Please ensure you have [Docker](https://docker.com) installed before proceeding.

1. `git clone git@github.com:catdadcode/pdk-data-importer.git && cd pdk-data-importer`

2. `docker compose up`

That's it! The project should now be running on `http://localhost:3000`.