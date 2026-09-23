# Privacy and Data Handling

Mangayomi is a self-hosted manga reader. This document describes the data the
current repository stores and moves, so operators can make informed deployment
decisions.

## Outbound Network Requests

The server makes no outbound network requests: no metadata lookups, update
checks, analytics, crash reports, or telemetry. The web app loads only from the
instance itself; fonts and icons are bundled.

## Server-Side Data

The `/config/mangayomi.db` SQLite database contains:

- The bcrypt hash of the account password.
- SHA-256 hashes of active session tokens and their expiry times.
- Library definitions: name, folder path, folder pattern, excluded folders,
  default reading direction, and scan interval.
- One row per work: relative path, title, author, series, page file names,
  page dimensions, size, and timestamps.
- Reading progress: last page, completion, and time of the last update.

`/config/cache/covers/` holds JPEG thumbnails generated from the first page of
each work. They can be deleted at any time and are regenerated on demand.

Mangayomi does not encrypt data at rest. Host filesystem permissions, disk
encryption, and backup controls protect stored data.

The `/data` mount holds your media. Mangayomi reads it and removes files there
only when you confirm a deletion.

## Browser Data

The browser keeps presentation state in `localStorage`: theme, language, the
selected library filter, reader layout and fit preferences, and per-series
reading-direction overrides. It holds the session cookie, which is `HttpOnly`.

When the web app is installed or visited, its service worker caches the app
shell, recently viewed covers (up to 3,000 for 30 days), and recently read pages
(up to 300 for 7 days). Clearing the site data in the browser removes them.
Cached images remain readable on that device after signing out, so clear site
data on a shared device.

## Logs

The server logs to standard output: startup settings (including the configured
directory paths), scan summaries, deletion counts, request failures, and paths
of archives that could not be read. Review and redact logs before sharing them.

## Sharing Diagnostics

Before sharing a log, database, or screenshot, remove passwords, session
cookies, personal paths, and titles you consider private.
