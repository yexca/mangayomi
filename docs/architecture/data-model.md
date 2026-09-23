# Data Model

The schema lives in `internal/store/store.go` as an ordered list of
migrations. The database records the applied count in `PRAGMA user_version`
and applies the remaining entries on startup, each in a transaction.

All timestamps are Unix milliseconds.

## Tables

### `settings`

Key-value pairs. Currently holds `password_hash` (bcrypt). Deleting it returns
the instance to first-run setup.

### `sessions`

| Column | Notes |
| --- | --- |
| `token_hash` | SHA-256 of the session token; the token itself is only in the cookie |
| `created_at`, `expires_at` | 30-day sessions, extended when less than half remains |

### `libraries`

| Column | Notes |
| --- | --- |
| `name` | Display name |
| `path` | Absolute container path inside the data directory |
| `pattern` | Folder pattern, e.g. `{author}/{series}`; empty means no metadata |
| `excludes` | JSON array of paths relative to `path` |
| `reading_direction` | `rtl` or `ltr`; the reader's default for the library |
| `scan_interval` | Minutes between automatic scans; `0` is manual only |
| `last_scan_at` | Last successful scan |

Library folders may not overlap each other.

### `works`

| Column | Notes |
| --- | --- |
| `library_id`, `rel_path` | Unique identity. `rel_path` is slash-separated; empty for a library root that is itself an image folder |
| `kind` | `archive` or `folder` |
| `title`, `author`, `series` | Derived from the path and the library pattern; empty author or series means none |
| `sort_key` | Natural-order key of the title |
| `pages` | Page entry names, NUL-separated (archive names may not be valid UTF-8) |
| `page_count` | Number of pages |
| `dims` | JSON `[{w,h}]`, filled on first reader visit, cleared when the work changes |
| `size`, `mtime` | Change detection; see [Scanning](scanning.md) |
| `added_at`, `updated_at` | Index timestamps |

Deleting a library cascades to its works.

### `progress`

One row per started work: `page`, `completed`, `updated_at`. No row means
unread. Marking a work unread deletes its row. Progress is deleted with the
work.

## Groups

Series and authors are not tables. They are aggregated from `works`:

- A series is a distinct non-empty `(author, series)` pair. Its cover is the
  first work in natural order.
- An author is a distinct non-empty `author`.

When the library filter is "All libraries", groups with the same names in
different libraries are merged.

## Changing The Schema

Append a new migration string; never edit a released one. Keep list responses
free of `null` arrays, and document the change in
[unreleased history](../history/unreleased.md).
