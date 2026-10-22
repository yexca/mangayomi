Initial version, planned as v0.1.0.

## Libraries and scanning

- Add libraries from folders under `/data`, with excluded folders and a folder
  pattern (`{author}`, `{series}`, `{ignore}`) that derives metadata.
- Preview how a folder will be parsed before saving.
- Treat `.zip`/`.cbz` files and folders that directly contain images as works.
- Incremental scans on demand or every 1, 6, 12, or 24 hours; an unreachable
  library root never clears the index.

## Browsing and reading

- Home, library, series, author, and work pages with search, status filter,
  sorting, and multi-select.
- Reader with right-to-left and left-to-right reading, single, double, and
  automatic layouts, spread detection, cover-alone option, tap zones, swipe,
  keyboard shortcuts, and automatic progress sync.
- Installable PWA with cached covers and recently read pages.
- Series and author lists load page by page as you scroll.

## Performance

- Covers are rendered in the background after each scan, and large pages are
  downscaled several times faster.

## Deletion

- Two-step deletion for a work, a selection, a series, or an author, listing
  every file and emptied folder before confirmation.

## Operations

- Single Docker image listening on port 7652 with `PUID`/`PGID` support, a
  health check, and a `reset-password` command.
- `docker-compose.yml` runs the published `yexca/mangayomi:latest` image;
  `docker-compose.dev.yml` builds from source for development.
- Release images for `linux/amd64` and `linux/arm64` on Docker Hub and GHCR
  (`yexca/mangayomi`), published by a tag-triggered release workflow.

## Development and docs

- The server builds with Go 1.27.3, which carries the standard library
  security fixes for `net/http`, `crypto/tls`, and `crypto/x509`.
- The web client builds with Node.js 24.22.1 in both CI and the Docker image,
  which carries the Node.js fixes for its Brotli decoder, TLS hostname checks,
  and `dns.resolve`.
- Release images build from base images pinned by digest, and workflows use
  actions pinned by commit SHA, kept current by Dependabot.
- CI runs `golangci-lint` and checks npm registry signatures; a daily workflow
  audits Go and npm dependencies against advisory databases.
