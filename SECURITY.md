# Security Policy

Mangayomi is a self-hosted, single-user manga library and reader. This policy
describes which versions receive security fixes and how to report a
vulnerability privately.

Deployment hardening guidance is in
[docs/operations/security.md](docs/operations/security.md). For a factual
description of stored data, see [PRIVACY.md](PRIVACY.md). The
[security documentation map](docs/security/index.md) explains which document to
use for each question.

## Supported Versions

| Version | Support |
| --- | --- |
| Latest release matching [VERSION](VERSION) | Supported |
| `main` after the latest release | Reports accepted; development code |
| Older releases and unofficial builds | Not supported |

## Security Model

Mangayomi has a small set of intentional trust boundaries:

- **Authentication.** Every API route except the health check, the auth status,
  setup, and sign-in requires a valid session. There is one account; whoever
  holds its password has full control, including deletion.
- **First-run setup.** Until a password is set, anyone who can reach the
  instance can set it. Complete setup before exposing the instance.
- **Filesystem.** The `/data` and `/config` mounts are trusted local inputs.
  Folder browsing, library roots, page reads, and deletion are confined to
  `/data`; deletion is further confined to the library that owns a work and can
  never remove a library root. Escaping these boundaries through the API is in
  scope.
- **Archives.** Zip entry names are treated as opaque keys and are never joined
  to filesystem paths, so a malicious archive cannot write or read outside
  itself.
- **Cross-site requests.** Session cookies are `HttpOnly` and `SameSite=Lax`,
  and every state-changing API request must carry a JSON content type, which
  browsers cannot send cross-site without a CORS preflight.

## Reporting a Vulnerability

Do not open a public issue, discussion, or pull request for an undisclosed
vulnerability. Use the private vulnerability reporting feature of the project
repository, or contact the maintainer privately.

Include:

- The affected version or commit and how it was deployed.
- Minimal reproduction steps using synthetic data.
- The expected and actual behavior.
- The security impact and any suggested mitigation.

Do not attach real databases, passwords, session cookies, personal media
paths, or media files. Redact logs before sending them.

## Examples of In-Scope Reports

- Authentication or session bypass, including reaching a protected route
  without a valid session.
- Reading, writing, or deleting files outside `/data`, or outside the library
  that owns a work.
- Deleting anything that was not listed in the deletion preview, or reusing a
  confirmation token.
- Cross-site request forgery against a state-changing route.
- Password hash or session token disclosure.

## Out of Scope

- Attacks that require the account password or shell access to the host.
- Denial of service by an authenticated user, such as scanning a very large
  folder.
- Deployments that expose an instance before completing first-run setup.
- Missing HTTPS; terminate TLS in a reverse proxy.
