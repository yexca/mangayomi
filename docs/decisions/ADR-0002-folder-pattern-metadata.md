# ADR-0002: Metadata From Folder Patterns

## Status

Accepted.

## Context

Personal manga collections are usually organized by folders such as
`Author/Series/Volume.cbz`, but the depth and meaning of each level differ
between collections. Embedded metadata is inconsistent or missing, and online
metadata lookups would add outbound requests and matching errors.

## Decision

Each library declares a folder pattern made of `{author}`, `{series}`, and
`{ignore}` segments. The pattern is matched against the folders above a work;
the work's own file or folder name is always its title. A folder that directly
contains images is a work, and the scanner does not descend into it.

A work's identity is `(library, relative path)`. Author and series are derived
values that are recomputed on every scan.

## Consequences

- Users can express their existing layout without renaming anything, and the
  preview shows the result before saving.
- Changing the pattern re-labels works without losing reading progress,
  because identity does not depend on metadata.
- Moving or renaming a file creates a new work and drops the old one, which
  loses its progress.
- Embedded metadata such as `ComicInfo.xml` can be added later as an optional
  source without changing identity.
