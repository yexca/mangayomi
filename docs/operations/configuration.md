# Configuration

Mangayomi is configured with environment variables. In Docker, the image sets
the container paths and Compose passes the rest from `.env`.

## Server Variables

| Variable | Default (binary) | Default (image) | Purpose |
| --- | --- | --- | --- |
| `MANGAYOMI_ADDR` | `:7652`, or `:$PORT` when `PORT` is set | `:7652` | Listen address |
| `MANGAYOMI_CONFIG_DIR` | `./config` | `/config` | Database and cover cache |
| `MANGAYOMI_DATA_DIR` | `./data` | `/data` | Root that libraries, folder browsing, and deletion are confined to |
| `MANGAYOMI_WEB_DIR` | `./web/dist` | `/app/web` | Built frontend; when missing, only the API is served |
| `MANGAYOMI_DEBUG` | unset | unset | Any value enables debug logs |

## Container Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUID`, `PGID` | `1000` | User and group the server runs as. `/config` is re-owned to them on start; `/data` is never re-owned |
| `TZ` | `UTC` | Time zone for log timestamps |

## Compose Variables

Set these in `.env` beside `docker-compose.yml`; see
[`.env.example`](../../.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `MANGAYOMI_IMAGE` | `yexca/mangayomi:latest` | Image to run with `docker-compose.yml` |
| `MANGAYOMI_PORT` | `7652` | Host port |
| `PUID`, `PGID`, `TZ`, `MANGAYOMI_DEBUG` | as above | Passed to the container |

Compose reads `.env` automatically and shell variables take precedence. Run
`docker compose up -d` after a change; `docker compose restart` does not
reload it.

## In-App Settings

Libraries, scan intervals, and the password are managed in the web UI under
**Settings** and stored in the database. Reader preferences, theme, and
language are stored per browser.

## Commands

The binary accepts a subcommand:

| Command | Purpose |
| --- | --- |
| `serve` (default) | Run the server |
| `reset-password` | Clear the password and all sessions; the next visit shows setup |
| `healthcheck` | Exit non-zero unless `/api/health` answers; used by the image |
| `version` | Print the version |

## Related Docs

- [Docker](docker.md)
- [Database](database.md)
- [Deployment security](security.md)
