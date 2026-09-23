# Libraries and Scanning

[English](libraries.md) · [简体中文](../zh-Hans/libraries.md) · [繁體中文](../zh-Hant/libraries.md) · [日本語](../ja/libraries.md) · [한국어](../ko/libraries.md)

A library is a folder inside `/data` that Mangayomi indexes. You can have
several, for example one for manga and one for artbooks. Library folders cannot
overlap.

## What Counts As A Work

- A `.zip` or `.cbz` file is one work. Its file name, without the extension, is
  the title.
- A folder that directly contains images (JPEG, PNG, GIF, WebP, BMP, AVIF) is
  one work. Its folder name is the title, and Mangayomi does not look inside
  its sub-folders.
- Other folders are only containers; Mangayomi looks inside them.

Pages are ordered naturally, so `2.jpg` comes before `10.jpg`. Hidden files and
NAS system folders such as `@eaDir` and `#recycle` are ignored.

## Folder Structure

The **Folder structure** pattern says what the folders above each work mean.

| Pattern | Layout | Result |
| --- | --- | --- |
| `{author}/{series}` | `Author/Series/Vol 01.cbz` | author, series, title |
| `{series}` | `Series/Vol 01.cbz` | series, title |
| `{author}` | `Author/Title.cbz` | author, title |
| Flat (no metadata) | anything | title only |
| Custom, e.g. `{ignore}/{author}/{series}` | `Magazine/Author/Series/Vol 01.cbz` | the first level is skipped |

With `{author}/{series}`:

```text
Author A/
  Series One/
    Vol 01.cbz        -> Author A · Series One · "Vol 01"
    Vol 02/           -> Author A · Series One · "Vol 02"
      001.jpg
      002.jpg
  Oneshot.zip         -> Author A · no series · "Oneshot"
Loose Artbook/        -> no author · no series · "Loose Artbook"
  001.jpg
```

A folder full of images is always a work, never an author or a series, even if
it sits at the level the pattern calls `{series}`. Levels deeper than the
pattern are ignored.

The form shows an example tree for the selected pattern. **Run preview** lists
the first 50 works the scanner would find, with their title, author, series,
and path, so you can check the pattern before saving.

## Excluded Folders

**Add excluded folder** opens a folder picker limited to the library folder.
Everything inside an excluded folder is skipped, and works already indexed from
it are removed from the library on the next scan (the files are not touched).

## Default Reading Direction

**Right to left** suits Japanese manga, **Left to right** suits comics and
webtoons exported as pages. The reader uses this default for every work in the
library until you change the direction for a series in the reader.

## Scanning

- Saving a library, or changing its folder, pattern, or exclusions, starts a
  scan.
- **Scan now** (the refresh button next to a library) scans on demand; **Scan
  all** (shown when there is more than one library) scans every library.
- **Automatic scan** repeats the scan every 1, 6, 12, or 24 hours, or never
  (**Manual only**).

Scans are incremental: unchanged files are skipped, changed files are
re-read, new ones are added, and missing ones are removed. While a scan runs,
the sidebar and the library list show how many works were found.

If the library folder cannot be read, for example because the NAS share is not
mounted, the scan stops with an error and keeps the existing index.

## Editing And Removing

- Changing the pattern re-labels works and keeps reading progress.
- Changing the folder starts over: the old index and its progress are dropped.
- **Remove library** removes the library and its progress from Mangayomi. Files
  on disk are not touched.

## Related Docs

- [Scanning (architecture)](../../architecture/scanning.md)
- [Troubleshooting](../../operations/troubleshooting.md)
