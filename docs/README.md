# Mangayomi Documentation

This is the public documentation for Mangayomi. It is organized by reader task:
using the product, running it, changing it, and reviewing design decisions.

## Start Here

- [User guide](user/index.md): installation, libraries, reading, managing
  works, and settings.
- [Overview](overview.md)
- [Getting started](user/en/getting-started.md)
- [Configuration](operations/configuration.md)
- [Troubleshooting](operations/troubleshooting.md)

## By Area

- [Architecture](architecture/index.md): system boundaries, modules, data, and
  scanning.
- [Product specs](user/en/index.md): user-visible screens and behavior.
- [Operations](operations/configuration.md): configuration, Docker, database,
  security, and troubleshooting.
- [Development](development/local-dev.md): local setup, testing, and
  contribution workflow.
- [Security documentation](security/index.md): reporting, deployment,
  development, and privacy guidance.
- [Decisions](decisions/index.md): durable architecture decision records.
- [History](history/index.md): release notes.

## Reading Paths

New users should read:

- [User guide](user/index.md)
- [Overview](overview.md)

Operators should read:

- [Docker](operations/docker.md)
- [Configuration](operations/configuration.md)
- [Database](operations/database.md)
- [Deployment security](operations/security.md)
- [Privacy and data handling](../PRIVACY.md)

Developers should read:

- [Repository agent guide](../AGENTS.md)
- [Design contract](development/design.md)
- [Architecture](architecture/index.md)
- [Scanning](architecture/scanning.md)
- [Testing](development/testing.md)
- [Secure development](development/security.md)
- [Commit and release](development/commit-and-release.md)

Security reporters should read:

- [Security policy](../SECURITY.md)
- [Security documentation map](security/index.md)

## Documentation Rules

- User-visible behavior belongs in [Product specs](user/en/index.md).
- User-facing translations belong in the matching locale under
  [User guide](user/index.md); the English pages are canonical.
- System boundaries belong in [Architecture](architecture/index.md).
- Runtime instructions belong in [Operations](operations/configuration.md).
- Local developer workflow belongs in [Development](development/local-dev.md).
- Security implementation rules belong in
  [Secure development](development/security.md).
- Durable design choices belong in [ADRs](decisions/index.md).
- `make docs` checks that relative links resolve and that every locale has
  every user page.
