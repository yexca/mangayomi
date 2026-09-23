# Secure Development

These rules apply to every change. See the [Security policy](../../SECURITY.md)
for the threat model.

## Filesystem

- Paths from requests or the database are untrusted until validated. Clean
  them, then check containment with `filepath.Rel` (see `within` helpers) —
  never with a plain string prefix.
- Folder browsing, library roots, and the folder picker are confined to
  `MANGAYOMI_DATA_DIR`. Library folders may not overlap.
- Archive entry names are lookup keys. Never join them to a filesystem path,
  and never extract archives to disk.
- Folder page names must be a single path element.
- Do not follow symlinked directories while scanning.
- Only `internal/deletion` removes user files. New destructive behavior must
  reuse its preview/token/confirm protocol and its path checks, and must
  refuse to delete a library root.

## Authentication And Requests

- New API routes are private by default. A public route needs a reason in
  review.
- State-changing routes must stay behind the JSON content-type check that
  blocks cross-site form posts.
- Never log passwords, session tokens, or cookies. Store only hashes.
- Compare secrets with constant-time functions (bcrypt does this for
  passwords; tokens are compared via their hash lookup).

## Errors And Logs

- Error messages returned to the client may include library paths the user
  already sees; they must not include stack traces or database details.
- Log paths at the level needed to diagnose a problem, and remember logs are
  shared by users when asking for help.

## Dependencies

- Prefer the standard library and pure-Go modules.
- Run `make backend-vuln` and `make frontend-audit` when adding or updating
  dependencies.

## Review Checklist

- Does the change read or write outside `/config` and `/data`?
- Can a request make the server touch a path outside its library?
- Could an unreadable or unmounted folder cause data loss in the index?
- Is every new route authenticated?
- Did `make sensitive-check` pass on the actual diff?
