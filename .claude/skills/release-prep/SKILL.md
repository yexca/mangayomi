---
name: release-prep
description: Prepare a Mangayomi release when the maintainer asks to get a named version ready, reconciling the pending notes with history before the documented release steps.
---

# Release Prep

The release steps themselves are in
[Releasing](../../../docs/development/commit-and-release.md#releasing). This
procedure adds the preparation around them.

1. Take the release tag from the maintainer. Read `VERSION` and the latest
   existing tag (`git describe --tags --abbrev=0`); the first release has no
   previous tag.
2. Reconcile the pending notes with history. Compare
   `git log --no-merges <previous tag>..HEAD` (or the whole history for the
   first release) with `docs/history/unreleased.md` and add each missing
   user-visible change under its area, as described in
   [Release Notes](../../../docs/development/commit-and-release.md#release-notes).
3. Check the schema. If the `migrations` list in `internal/store/store.go`
   grew since the previous tag, say so in the release notes with any operator
   action; existing databases migrate on startup.
4. Set `VERSION`, move the notes to `docs/history/<tag>.md`, reset
   `unreleased.md`, and link the new page from `docs/history/index.md`.
5. Review `README.md` for stale claims and update its translations with the
   `doc-locale-sync` skill.
6. Run `make ci-local` and `make sensitive-check`. Leave the result for the
   maintainer's review. Committing, pushing, and tagging wait for the
   maintainer's approval.
