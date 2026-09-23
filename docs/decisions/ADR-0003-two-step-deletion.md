# ADR-0003: Two-Step Deletion

## Status

Accepted.

## Context

Users need to remove unwanted works, including whole series or everything by
an author, directly from the NAS. Deleting files is irreversible, and a
selection resolved at click time could differ from what the user reviewed if
a scan runs in between.

## Decision

Deletion is a two-request protocol:

1. **Preview** resolves the target (work ids, series, or authors) to concrete
   paths, validates each against its library and the data directory, lists the
   files and the parent folders that would become empty, and returns a random
   token valid for ten minutes.
2. **Confirm** accepts only that token, deletes exactly the works the preview
   resolved, removes the listed folders only if they are still empty, and
   invalidates the token.

The UI shows the preview as the first step and requires a second explicit
confirmation, including typing `delete` for bulk operations.

## Consequences

- What the user reviewed is what gets deleted; new files that appear after the
  preview are never included.
- A library root can never be deleted, even if it is itself a work.
- One code path, `internal/deletion`, owns every destructive filesystem call.
- Tokens are kept in memory, so a server restart cancels pending confirmations.
