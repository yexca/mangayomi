# Contributing

Thanks for helping improve Mangayomi. The project is young and changes
quickly, so small, focused changes are easiest to review and keep stable.

## Before Changing Code

Read the public docs that match the area you are changing:

- Architecture changes: `docs/architecture/`
- User-facing behavior: `docs/user/` and `docs/user/en/`
- Runtime or deployment behavior: `docs/operations/`
- Development workflow: `docs/development/`
- Security-sensitive implementation: `docs/security/` and
  `docs/development/security.md`
- Major design decisions: `docs/decisions/`

## Core Rules

- Treat `/data` as the user's property: read it, and change it only through the
  two-step deletion flow.
- Keep derived state (database, covers) in `/config`.
- Do not commit runtime data, local media, cover caches, SQLite databases,
  secrets, or personal paths.
- Update public documentation when behavior changes.
- Keep changes scoped to the feature or fix being implemented.

## Commit Messages

Use:

```text
<type>(scope): <description>
```

Examples:

```text
feat(reader): add vertical scroll mode
fix(scan): keep works when a folder is unreadable
docs(libraries): describe folder patterns
```

## Security Reports

Do not disclose suspected vulnerabilities in public issues, discussions, or
pull requests. Follow the private reporting process in the
[Security Policy](SECURITY.md).

## Validation

The Makefile is the canonical validation entry point. Use the smallest target
that covers the files you changed:

```sh
make docs          # documentation links and locale coverage
make ci-style      # Go formatting, frontend lint and types, docs
make ci-backend    # go mod verify, golangci-lint, vet, tests, race tests, govulncheck
make ci-frontend   # npm audit, registry signatures, and production build
make smoke         # Docker image and runtime behavior
```

`make ci-local` runs everything CI runs. Before every commit, run the privacy
scan against the working tree:

```sh
make sensitive-check
```

Direct commands are useful for focused iteration, but they do not replace the
corresponding Makefile target:

```sh
go test ./internal/scanner/
cd web && npm run typecheck
```

## Documentation Rules

- Put stable public documentation under `docs/`.
- Put user-visible behavior in `docs/user/en/`; translations live beside it
  and link back to the English page.
- Put system boundaries and module design in `docs/architecture/`.
- Put runtime setup, configuration, and troubleshooting in `docs/operations/`.
- Put local development and test instructions in `docs/development/`.
- Capture durable architectural decisions as ADRs in `docs/decisions/`.

## Sensitive Data Check

Before committing, check for:

- SQLite databases, cover caches, or media files.
- Personal filesystem paths, NAS share names, or e-mail addresses.
- Passwords, session tokens, or `.env` files.
- Real manga titles or authors in fixtures.

Use the generic names in
[Synthetic Fixture Data](docs/development/testing.md#synthetic-fixture-data).
Review the actual diff, not only the files you intended to change.
