# ADR-0001: SQLite First

## Status

Accepted.

## Context

Mangayomi is a personal reader that runs as one container on a NAS. It needs
durable state for libraries, works, progress, and sessions, but has one writer
and modest data volumes.

## Decision

Use SQLite as the only database, through the pure-Go `modernc.org/sqlite`
driver, in WAL mode with foreign keys enabled. Keep the schema as an ordered
list of migrations in `internal/store`.

## Consequences

- No database container and no CGO, which keeps the image small and
  cross-compilation simple.
- Backups are a file copy while the container is stopped.
- The deployment is single-instance; two servers must not share one database
  file.
- Released migrations are immutable; schema changes append new entries.
