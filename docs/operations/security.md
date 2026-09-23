# Deployment Security

Mangayomi is designed for a home network. It has one account, and that account
can delete files in every library.

## Before Exposing An Instance

- **Complete setup first.** Until a password is set, anyone who can reach the
  instance can set it.
- **Use a strong password.** The minimum is six characters; use more.
- **Terminate TLS.** Serve through a reverse proxy with HTTPS for anything
  beyond a trusted LAN. The proxy should send `X-Forwarded-Proto: https` so
  cookies are marked `Secure`.
- **Limit reachability.** Bind the port to a LAN address or loopback
  (`127.0.0.1:7652:7652`), use a VPN, or add proxy authentication if the
  instance must be reachable from the internet.

## Authentication

- Passwords are stored as bcrypt hashes. Session tokens are random 256-bit
  values; only their SHA-256 hashes are stored.
- Sessions last 30 days and are extended on use. Changing the password signs
  out every other session. `reset-password` signs out all sessions.
- After ten failed sign-ins from one address within 15 minutes, further
  attempts are refused until the window passes. Behind a reverse proxy all
  clients share the proxy's address, so failed attempts from anyone count
  together.

## Filesystem Mounts

- Mount only what should be browsable at `/data`; the folder picker can list
  every directory below it.
- `/data` must be writable for deletion. If you never want files deleted from
  the app, mount it read-only (`/path/to/manga:/data:ro`); deletions will then
  fail and be reported without removing anything.
- The server runs as `PUID:PGID`, not root. Choose a user that can read your
  manga and has no access to anything else.

## Logs

Logs include configured paths and the paths of unreadable archives. Treat
them as private and redact them before sharing.

## Related Docs

- [Security policy](../../SECURITY.md)
- [Privacy](../../PRIVACY.md)
- [Docker](docker.md)
