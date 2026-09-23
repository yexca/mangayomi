# Getting Started

[English](getting-started.md) · [简体中文](../zh-Hans/getting-started.md) · [繁體中文](../zh-Hant/getting-started.md) · [日本語](../ja/getting-started.md) · [한국어](../ko/getting-started.md)

## Requirements

- Docker with Docker Compose on the NAS or server.
- Your manga as `.zip`/`.cbz` files or folders of images.
- Optional, for local development: Go and Node.js; see
  [Local development](../../development/local-dev.md).

## Run With Docker

1. Put this repository on the Docker host.
2. Edit the data volume in `docker-compose.yml` so it points at your manga:

   ```yaml
   volumes:
     - ./config:/config
     - /path/to/manga:/data
   ```

3. Optionally copy `.env.example` to `.env` and set `PUID`/`PGID` to the owner
   of your files, or `MANGAYOMI_PORT` to use another port.
4. Start it:

   ```sh
   docker compose up -d --build
   ```

5. Open `http://<server-address>:8080`.

## First Sign-In

The first visit asks you to create a password (at least six characters). There
is a single account; the same password signs you in on every device. Sessions
last 30 days and are extended while you use them.

Forgot the password? See [Troubleshooting](../../operations/troubleshooting.md#forgot-the-password).

## Add Your First Library

1. Open **Settings** and choose **Add library**.
2. Under **Folder**, choose **Choose folder** and pick a folder inside `/data`.
3. Pick the **Folder structure** that matches your layout, for example
   `{author}/{series}` for `Author/Series/Volume.cbz`.
4. Optionally add **Excluded folders**.
5. Choose **Run preview** to see how the first 50 works will be parsed.
6. Choose **Save**. The library is scanned in the background; works appear as
   soon as the scan finishes.

Details are in [Libraries and scanning](libraries.md).

## Install On A Phone

Open the instance in the phone's browser and use **Add to Home Screen**
(Safari) or **Install app** (Chrome). The app opens full screen and keeps
recently read pages available. Installation requires HTTPS unless you use
`localhost`; see [Docker](../../operations/docker.md#reverse-proxy).

## Next Steps

- [Reading](reader.md)
- [Browsing and managing works](managing.md)
- [Configuration](../../operations/configuration.md)
