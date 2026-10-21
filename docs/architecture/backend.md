# Backend

The backend is a Go module at the repository root. It uses the standard
library HTTP server and router, `modernc.org/sqlite` (pure Go, no CGO),
`golang.org/x/image` for WebP, BMP, and scaling, and `golang.org/x/crypto` for
bcrypt.

## Packages

| Package | Responsibility |
| --- | --- |
| `cmd/mangayomi` | Entry point and subcommands: `serve`, `reset-password`, `healthcheck`, `version`. Wires packages together and handles shutdown. |
| `cmd/sampledata` | Development tool that writes a synthetic library. |
| `internal/config` | Reads `MANGAYOMI_*` environment variables. |
| `internal/api` | HTTP routes, middleware (auth, JSON-only mutations, panic recovery), request parsing, and static file serving with SPA fallback. |
| `internal/auth` | Password hashing, sessions, sliding expiry, and login rate limiting. |
| `internal/scanner` | Folder walking, pattern parsing, incremental indexing, scan status, and the scheduler. See [Scanning](scanning.md). |
| `internal/deletion` | The two-step deletion protocol and path validation. |
| `internal/media` | Page reading from folders and zip archives, a reference-counted zip handle cache, page dimensions, and cover thumbnails. |
| `internal/store` | Schema, migrations, and every SQL query. |
| `internal/natural` | Natural ordering ("Vol 2" before "Vol 10") and its sortable key. |

Dependencies point downward:
`cmd -> api -> scanner, deletion, auth -> store, media -> natural, config`.

## HTTP API

All routes are under `/api`. Everything except `GET /api/health`,
`GET /api/auth/status`, `POST /api/auth/setup`, `POST /api/auth/login`, and
`POST /api/auth/logout` requires a session cookie.

| Area | Routes |
| --- | --- |
| Auth | `GET auth/status`, `POST auth/setup`, `POST auth/login`, `POST auth/logout`, `POST auth/password` |
| Folders | `GET fs/browse?path=&base=` |
| Libraries | `GET/POST libraries`, `GET/PUT/DELETE libraries/{id}`, `POST libraries/preview`, `POST libraries/{id}/scan`, `POST libraries/scan`, `GET scan/status` |
| Works | `GET home`, `GET works`, `GET works/{id}`, `GET works/{id}/pages`, `GET works/{id}/pages/{n}`, `GET works/{id}/cover`, `PUT works/{id}/progress`, `POST progress/batch` |
| Groups | `GET series`, `GET authors` |
| Deletion | `POST delete/preview`, `POST delete/confirm` |

Conventions:

- Errors are `{"error": "...", "code": "..."}`. The frontend translates known
  codes and falls back to the message.
- Lists are always JSON arrays, never `null`.
- `POST`, `PUT`, and `DELETE` requests must send `Content-Type:
  application/json`; others receive `415`.
- Page and cover URLs carry `?v=<mtime>` so browsers and the service worker can
  cache them for a week. Pages also send an `ETag`.

## Media

- Zip archives are opened once and kept in an LRU cache of 16 handles, shared
  by concurrent requests and reference-counted so eviction never closes a
  handle that is still streaming. A handle is reopened when the file's size or
  modification time changes, and evicted before deletion.
- Entry names are opaque keys looked up in the archive's directory; they are
  never joined to a filesystem path.
- Covers are the first page scaled to 400 px wide, encoded as JPEG, written to
  `/config/cache/covers/<id>.jpg`, and generated at most two at a time.
  Concurrent requests for the same cover share one render.
- Large pages are box-averaged on their decoded planes (YCbCr, gray, RGBA) to
  between one and two cover widths before the bilinear pass; filtering the
  full page with the bilinear kernel cost about as much as decoding it.
- After a scan that adds or changes works, and for every library at startup,
  one background worker renders missing covers in title order, one at a time,
  so on-demand requests keep a decode slot. A cover that fails is retried only
  after its work changes.
- Page dimensions are read from image headers on the first reader visit and
  stored, so the reader can pair pages and detect spreads before loading them.

## Related Docs

- [Data model](data-model.md)
- [Scanning](scanning.md)
- [Backend guidelines](../development/backend-guidelines.md)
- [Secure development](../development/security.md)
