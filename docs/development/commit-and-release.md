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

1. Update `VERSION` and move the release notes to `docs/history/<tag>.md`.
2. Run `make ci-local`.
3. Tag the commit with the exact `VERSION` value and push the tag:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

The tag starts `.github/workflows/release.yml`, which:

1. Fails unless the tag equals `VERSION` and `docs/history/<tag>.md` exists.
2. Runs the full CI workflow, including the Docker smoke test.
3. Builds `linux/amd64` and `linux/arm64` images and pushes them to
   `ghcr.io/yexca/mangayomi` and `docker.io/yexca/mangayomi`, tagged
   `<version>`, `<major>.<minor>`, and `latest`. Pre-release tags such as
   `v0.2.0-rc.1` get only the exact version tag.
4. Creates the GitHub release with the notes file as its body.

The Docker Hub login uses the `yexca` account and the `DOCKERHUB_TOKEN`
Actions secret, a Docker Hub access token with read and write scope. GHCR uses
the workflow's `GITHUB_TOKEN`.
