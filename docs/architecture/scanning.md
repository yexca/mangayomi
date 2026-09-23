# Scanning

Scanning turns a library folder into rows in `works`. It never writes to
`/data`.

## What Is A Work

The walker visits the library root recursively, in natural order:

1. Names starting with `.` and known junk (`@eaDir`, `#recycle`, `#snapshot`,
   `$RECYCLE.BIN`, `System Volume Information`, `__MACOSX`, `Thumbs.db`,
   `desktop.ini`) are skipped.
2. Excluded folders (paths relative to the library root) are skipped with
   everything inside them.
3. Every `.zip` or `.cbz` file is a work.
4. A folder that directly contains at least one image (`.jpg`, `.jpeg`,
   `.png`, `.gif`, `.webp`, `.bmp`, `.avif`) is a work. The walker does not
   descend into it.
5. Otherwise the walker descends into sub-folders. Symlinked files are
   followed; symlinked folders are not, to avoid loops.

An archive with no images is not a work.

## Pages

- Archive pages are the image entries of the zip, excluding hidden and junk
  paths, sorted naturally by their full entry name.
- Folder pages are the images directly inside the folder, sorted naturally.

## Metadata

The work's own name is its title (archive extension removed). The folders
between the library root and the work are matched, level by level, against the
library pattern:

| Segment | Meaning |
| --- | --- |
| `{author}` | This level is the author |
| `{series}` | This level is the series |
| `{ignore}` or `*` | Skip this level |

Levels deeper than the pattern are ignored. A work that sits higher than the
pattern has fewer fields filled. With `{author}/{series}`:

```text
Author A/Series One/Vol 01.cbz     -> author "Author A", series "Series One", title "Vol 01"
Author A/Series One/Vol 02/*.jpg   -> author "Author A", series "Series One", title "Vol 02"
Author A/Oneshot.zip               -> author "Author A", title "Oneshot"
Author A/Series One/Extras/X.cbz   -> author "Author A", series "Series One", title "X"
Loose.cbz                          -> title "Loose"
```

## Incremental Updates

Each scan loads the existing index for the library and compares every
candidate with it:

- **Archive unchanged** when kind, size, and modification time match.
- **Folder unchanged** when kind, the folder's modification time, and the image
  count match. Adding, removing, or renaming images changes the folder time.
- Unchanged works only have their title, author, and series refreshed if the
  pattern now yields different values. Progress is kept.
- Changed works are re-read, their cached cover and page dimensions are
  discarded, and progress is clamped to the new page count.
- Unreadable archives are logged and keep their previous row.

Works that were not seen are removed from the index, with two exceptions that
protect against unmounted or flaky storage:

- If the library root cannot be read, the scan fails and nothing is removed.
- Works below a sub-folder that could not be read are kept.

Adding an excluded folder removes its works from the index on the next scan.
Changing a library's folder drops its index and rescans from scratch.

## Scheduling

A scan runs in a background goroutine; a library never has two scans at once.
The scheduler wakes once a minute and starts scans for libraries whose
interval has elapsed since `last_scan_at`. Saving a new library or changing its
folder, pattern, or exclusions starts a scan immediately.

## Related Docs

- [Data model](data-model.md)
- [ADR-0002: Metadata from folder patterns](../decisions/ADR-0002-folder-pattern-metadata.md)
- [Libraries (user guide)](../user/en/libraries.md)
