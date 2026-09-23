# Docker

The repository builds one image containing the Go server and the built web
app. The final stage is Alpine with `su-exec` and `tzdata`.

## Build And Run

```sh
docker compose up -d --build
```

or, through the Makefile:

```sh
make docker-up        # build and start with docker-compose.yml
make docker-status
make docker-logs
make docker-down
```

`make docker-build` builds `mangayomi:dev` (override with `DOCKER_IMAGE=...`)
and injects the version from `VERSION`.

## Mounts

| Container path | Purpose |
| --- | --- |
| `/config` | SQLite database and `cache/covers`. Back it up. |
| `/data` | Your manga. Point it at the share, e.g. `/path/to/manga:/data`. Must be writable for deletion. |

Libraries can only be created inside `/data`. To serve several shares, mount
them below it, for example `/path/to/manga:/data/manga` and
`/path/to/doujin:/data/doujin`, and add each as its own library.

## Users And Permissions

The entrypoint starts as root, re-owns `/config` to `PUID:PGID` when needed,
and then runs the server as that user. `/data` is never re-owned. Set `PUID`
and `PGID` to the owner of your files so reading works and deleted files are
removed with the right permissions.

On a NAS, run `id <user>` to find the values.

## Health

The image declares a health check that runs `mangayomi healthcheck` every 30
seconds. `docker ps` shows `healthy` once the server answers.

## Upgrades

1. Back up `config/`.
2. Pull the new source and run `docker compose up -d --build`.

Database migrations run on startup.

## Reverse Proxy

Mangayomi serves plain HTTP. For access outside the LAN, put it behind a
reverse proxy that terminates TLS. When the proxy sets
`X-Forwarded-Proto: https`, session cookies are marked `Secure`. PWA
installation on phones requires HTTPS (or `localhost`).

## Related Docs

- [Configuration](configuration.md)
- [Deployment security](security.md)
- [Troubleshooting](troubleshooting.md)
