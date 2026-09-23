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

## Deletion

- Two-step deletion for a work, a selection, a series, or an author, listing
  every file and emptied folder before confirmation.

## Operations

- Single Docker image with `PUID`/`PGID` support, health check, and a
  `reset-password` command.
