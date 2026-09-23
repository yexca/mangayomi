<p align="center">
  <img src="docs/assets/mangayomi-icon.png" width="128" height="128" alt="Mangayomi logo">
</p>

<h1 align="center">Mangayomi</h1>

<p align="center">
  A self-hosted manga library and reader for your NAS.
</p>

<p align="center">
  <a href="docs/README.md">Documentation</a> ·
  <a href="SECURITY.md">Security</a> ·
  <a href="PRIVACY.md">Privacy</a>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="docs/readme/README.zh-Hans.md">简体中文</a> ·
  <a href="docs/readme/README.zh-Hant.md">繁體中文</a> ·
  <a href="docs/readme/README.ja.md">日本語</a> ·
  <a href="docs/readme/README.ko.md">한국어</a>
</p>

Mangayomi indexes the comic archives and image folders you already keep on a
NAS, derives authors and series from your folder layout, and serves them to a
responsive web reader that installs as a PWA on phones and tablets. It is a Go
server and a React frontend, packaged as one Docker image backed by SQLite.

> [!IMPORTANT]
> Mangayomi is under active development. Back up `config/` before an upgrade,
> and review the [deployment security](docs/operations/security.md) notes
> before exposing an instance to a network. The delete feature removes files
> from your storage permanently.

## Key Features

- **Your folders, your structure.** Add any folder below `/data` as a library,
  exclude sub-folders, and describe the layout with a pattern such as
  `{author}/{series}`. A preview shows how every work will be parsed before
  you save.
- **Archives and image folders.** A `.zip` or `.cbz` file is a work. A folder
  that directly contains images is a work too, and its name is the title
  rather than an author or series.
- **Incremental and scheduled scans.** Scan on demand or every 1–24 hours.
  Unchanged files are skipped, and an unreachable library root never wipes the
  index.
- **A reader built for phones.** Right-to-left or left-to-right (remembered per
  series), single, double, or automatic page layout, wide spreads shown alone,
  tap zones, swipe, keyboard shortcuts, and automatic progress sync.
- **Careful deletion.** Delete one work, a multi-selection, a whole series, or
  everything by an author. The first step lists every file and folder that will
  be removed; the second asks for explicit confirmation.
- **Small and private.** Single-user password sign-in, no external services,
  no telemetry.

## Quick Start

### 1. Prepare the deployment directory

Place [`docker-compose.yml`](docker-compose.yml) and the rest of this
repository on the Docker host (the image is built locally). Optionally copy
[`.env.example`](.env.example) to `.env` to change the port, the image, or the
user that owns your files.

### 2. Point `/data` at your manga

Edit the `./data:/data` volume in `docker-compose.yml` so it points at your
manga share, for example `/path/to/manga:/data`. Set `PUID` and `PGID` in `.env`
to the owner of those files (run `id` on the NAS).

### 3. Start Mangayomi

```sh
docker compose up -d --build
```

Open <http://127.0.0.1:8080>, create a password, then add a library under
**Settings → Libraries**. See [Getting started](docs/user/en/getting-started.md)
for a walkthrough.

## Runtime Data

| Host path | Container path | Purpose | Back up? |
| --- | --- | --- | --- |
| `./config` | `/config` | SQLite database (libraries, progress, sessions) and the cover cache | Yes |
| `./data` | `/data` | Your manga. Read for reading; written only when you delete | Your own backups |

Do not commit these runtime directories. They may contain private media,
password hashes, and session state.

## Documentation

| Goal | Start here |
| --- | --- |
| Use Mangayomi | [User Guide](docs/user/index.md) |
| Install and scan a first library | [Getting Started](docs/user/en/getting-started.md) |
| Configure and operate an instance | [Operations](docs/operations/configuration.md) |
| Understand the system | [Architecture](docs/architecture/index.md) |
| Review design and security contracts | [Design](docs/development/design.md) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) |
| Find every public document | [Documentation Index](docs/README.md) |

## Development and Contributing

Development setup, validation commands, and release procedures live under
`docs/development/` so this README can stay focused on installation and product
behavior.

- [Local Development](docs/development/local-dev.md)
- [Testing](docs/development/testing.md)
- [Contributing](CONTRIBUTING.md)
- [Agent Guide](AGENTS.md)

## Security and Privacy

Every API call except sign-in and the health check requires the single user's
password.
Mangayomi makes no outbound network requests. Report a suspected vulnerability
through the private process in [SECURITY.md](SECURITY.md), and review
[PRIVACY.md](PRIVACY.md) before sharing logs or diagnostics.
