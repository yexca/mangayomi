# Backend Guidelines

## Principles

- Read `/data`; change it only in `internal/deletion`.
- Keep derived state in `/config`.
- Re-validate every path taken from the database or a request against the
  data directory and the owning library before using it.
- Treat an unreadable directory as unknown, never as empty.
- Keep HTTP handling in `internal/api`, SQL in `internal/store`, and
  filesystem effects in their feature packages.
- Return `[]`, not `null`, for empty lists.
- Return errors as `{"error", "code"}`; add a stable `code` for anything the
  UI should translate.
- Prefer the standard library. Add a dependency only when it removes real
  complexity, and prefer pure-Go packages so the image stays CGO-free.

## Adding An API Route

1. Register it in `Handler()` in `internal/api/server.go`, with `private(...)`
   unless it must work before sign-in.
2. Mutating routes read JSON bodies with `readJSON`; the JSON content-type
   check applies automatically.
3. Put the logic in a package, not in the handler.
4. Document it in [Backend architecture](../architecture/backend.md).

## Changing The Schema

Append a migration to the list in `internal/store/store.go`. Never edit or
reorder a released entry. Update [Data model](../architecture/data-model.md).

## Validation

```sh
make ci-backend
```

See [Backend architecture](../architecture/backend.md),
[Secure development](security.md), and [Testing](testing.md).
