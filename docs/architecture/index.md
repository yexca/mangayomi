# Architecture

Mangayomi is organized around a single rule:

```text
The files under /data belong to the user. Mangayomi reads them; it only
changes them through the two-step deletion flow.
```

Everything Mangayomi derives (the index, covers, page sizes, progress) lives in
`/config` and can be rebuilt from `/data` by scanning, except reading progress
and settings.

## Architecture Topics

- [Backend](backend.md)
- [Frontend](frontend.md)
- [Data model](data-model.md)
- [Scanning](scanning.md)

## When To Read What

- Read [Scanning](scanning.md) before changing how works are discovered,
  identified, or labeled.
- Read [Data model](data-model.md) before changing the schema.
- Read [Backend](backend.md) before adding an API route or a package.
- Read [Frontend](frontend.md) before changing routing, data fetching, or the
  reader.
- Read [ADR-0003](../decisions/ADR-0003-two-step-deletion.md) before touching
  anything that removes files.

## Runtime Topology

```text
Browser (React app, service worker)
  -> Go HTTP server (API + static web app)
  -> SQLite in /config, cover cache in /config/cache/covers
  -> manga files in /data (zip handles cached, read-only except deletion)
```

A single process serves the API and the built frontend. Scans run in
background goroutines, one per library at a time, and a scheduler checks once a
minute for libraries whose scan interval has elapsed.

## Related Docs

- [User guide](../user/index.md)
- [Backend guidelines](../development/backend-guidelines.md)
- [ADR index](../decisions/index.md)
