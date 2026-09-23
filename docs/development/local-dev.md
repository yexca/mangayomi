# Local Development

Requirements: Go (version in `go.mod`), Node.js (version in `.nvmrc`) with npm,
GNU Make, and Docker for image and smoke tests.

## Sample Library

Write a synthetic library to `data/sample`:

```sh
make sample-data
```

It contains archives, image folders, a wide spread page, a loose work at the
root, and a `_drafts` folder to try exclusions.

## Backend

```sh
make backend-run
```

The server listens on `:8080` and uses `./config` and `./data` relative to the
repository root. It also serves `web/dist` when it exists, so after
`make frontend-build` the backend alone is a complete app. Set `PORT` or
`MANGAYOMI_ADDR` to use another port.

## Frontend

```sh
cd web
npm ci
npm run dev
```

Vite serves on `:5173` and proxies `/api` to `http://localhost:8080`. Set
`MANGAYOMI_API` to proxy elsewhere, for example
`MANGAYOMI_API=http://localhost:18080 npm run dev`. The session cookie is
shared because both run on `localhost`.

Add a shadcn/ui primitive with the CLI rather than writing it by hand:

```sh
cd web
npx shadcn@latest add <component>
```

## Docker

```sh
make docker-up
```

Uses `docker-compose.yml` with the repository's `config/` and `data/`.

## Common Checks

- Backend and frontend checks: [Testing](testing.md)
- Security-sensitive changes: [Secure development](security.md)
- Commit format: [Commit and release](commit-and-release.md)

## Useful Paths

- Entry point: `cmd/mangayomi`
- API routes: `internal/api/server.go`
- Schema: `internal/store/store.go`
- Frontend source: `web/src`
- UI strings: `web/src/i18n/locales/en.json`
- Public docs: `docs`

## Related Docs

- [Backend guidelines](backend-guidelines.md)
- [Frontend guidelines](frontend-guidelines.md)
- [Architecture](../architecture/index.md)
