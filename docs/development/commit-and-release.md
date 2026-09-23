# Commit And Release

## Commit Format

Use:

```text
<type>(scope): <description>
```

Examples:

```text
feat(reader): add vertical scroll mode
fix(scan): keep works under unreadable folders
docs(readme): describe PUID and PGID
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `chore`.
Run `make sensitive-check` before every commit.

## Release Notes

Collect user-visible changes in
[`docs/history/unreleased.md`](../history/unreleased.md) as they land, grouped
by area:

- Libraries and scanning.
- Browsing and reading.
- Deletion.
- Operations.
- Development and docs.

At release time, move the content to `docs/history/<tag>.md` (the file starts
directly with the release body, without repeating the tag as a heading), link
it from the [history index](../history/index.md), and reset the unreleased
page.

## Version Source

`VERSION` is the single source of the application version, in the
`v<major>.<minor>.<patch>` format. `make backend-build` and `make docker-build`
inject it into the binary; `mangayomi version` prints it and the server logs
it on startup.

## Releasing

1. Update `VERSION` and the release notes.
2. Run `make ci-local`.
3. Tag the commit with the exact `VERSION` value.
4. Build and publish the image with `make DOCKER_IMAGE=<registry>/mangayomi:<tag> docker-build`.
