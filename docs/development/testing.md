# Testing

The goal is the smallest test set that gives strong confidence in a real
behavior or stable contract. Before adding a test, state the regression it is
meant to catch.

## Value Gate

A test is valuable when:

1. It protects user-visible behavior, a documented contract, a security
   boundary, a state transition, or a previous regression.
2. A realistic defect in production code would make it fail.
3. The behavior is not already covered at a more appropriate layer.
4. It survives an internal refactor that preserves behavior.

Scanning rules, path validation, deletion, authentication, and bug fixes
normally require coverage. Pure presentation changes normally do not.

## Choose the Lowest Sufficient Layer

| Behavior | Preferred layer |
| --- | --- |
| Ordering, pattern parsing, spread grouping | Unit test beside the source |
| Scanning and deletion against real files | Package test with `t.TempDir()` and a real store |
| HTTP authentication or response shape | Handler test |
| Container, entrypoint, and end-to-end API flow | `make smoke` |

Current backend tests cover natural ordering, pattern parsing, full and
incremental scans (including unchanged rescans, pattern changes, removals, and
an unavailable root), and deletion (series with emptied folders, token reuse,
library-root refusal, empty author/series targets).

## Synthetic Fixture Data

Every tracked fixture is public. Construct the smallest data that exercises the
contract, and never copy a real collection, database, log, or path.

| Fixture field | Use |
| --- | --- |
| Authors | `Author A`, `Author B` |
| Series | `Series One`, `Series Alpha`, `S1` |
| Works | `Vol 01`, `Chapter 1`, `Oneshot`, `Sketchbook` |
| Pages | Generated in-test PNG or JPEG images; names like `001.png` |
| Paths | A `t.TempDir()` root, or `/path/to/manga` in docs |
| Passwords | `synthetic-password` |
| Domains | `example.com`, `example.invalid` |

Do not use real manga titles, authors, or publisher names, even as
placeholders. `cmd/sampledata` follows the same rules.

## Commands

| Command | What it runs |
| --- | --- |
| `make backend-test` | `go test ./...` |
| `make backend-race` | Tests with the race detector (needs a C toolchain) |
| `make backend-coverage` | Tests with a coverage summary |
| `make frontend-typecheck` | `tsc -b` |
| `make frontend-lint` | `oxlint` |
| `make frontend-build` | Production build including the service worker |
| `make docs` | Relative links and locale coverage in public docs |
| `make smoke` | Builds the image and runs `scripts/smoke.mjs` |
| `make ci-local` | Everything CI runs |

## Smoke Test

`scripts/smoke.mjs` starts the image with disposable mounts and a generated
sample library, then checks: health, static serving, the auth boundary,
first-run setup, library creation with an exclusion, scan results, folder
pattern metadata, page and cover serving, and a full two-step deletion
including token reuse. It needs Go (to generate the sample) and Docker.

## Before Committing

Run `make sensitive-check`. It scans tracked and untracked, non-ignored files
for databases, media archives, images outside `web/public` and `docs/assets`,
`.env` files, personal home or NAS paths, e-mail addresses, private keys, and
token-shaped strings. Review every finding. If something is genuinely public,
add an entry with a reason to `scripts/sensitive-allowlist.json`:

```json
[{ "path": "docs/example.md", "rule": "email", "reason": "Published contact address" }]
```
