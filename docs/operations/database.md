# Database

Mangayomi stores its state in `/config/mangayomi.db`, a SQLite database in WAL
mode. While the server runs you will also see `mangayomi.db-wal` and
`mangayomi.db-shm`.

## What Is Stored

Libraries, the work index, reading progress, the password hash, and sessions.
See [Data model](../architecture/data-model.md) for the tables and
[PRIVACY.md](../../PRIVACY.md) for a data inventory.

## Backup

Stop the container, then copy the whole `config/` directory:

```sh
docker compose stop
cp -a config config.backup
docker compose start
```

Copying only `mangayomi.db` while the server runs can miss recent writes that
are still in the WAL file.

The cover cache under `config/cache/covers` can be excluded from backups; it is
regenerated on demand.

## What Can Be Rebuilt

- The work index is rebuilt by scanning.
- Covers are regenerated in the background after startup and scans, or when
  viewed. Page dimensions are regenerated when a work is opened.
- Reading progress, library definitions, and the password cannot be rebuilt.

## Migrations

Migrations run automatically on startup. Keep a backup before upgrading; a
database migrated by a newer version is not supported by an older one.

## Reset

- Forgotten password: `docker compose exec -u <PUID>:<PGID> mangayomi /app/mangayomi reset-password`.
- Full reset: stop the container and delete `config/`. Your manga in `/data` is
  not affected.
