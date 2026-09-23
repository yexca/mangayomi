# Troubleshooting

## The port is already in use

Set another host port in `.env`, for example `MANGAYOMI_PORT=18080`, and run
`docker compose up -d`.

## A folder does not appear in the folder picker

Only folders inside `/data` can be chosen. Check the volume in
`docker-compose.yml`, and that `PUID:PGID` can read the folder. Hidden folders
and NAS system folders such as `@eaDir` and `#recycle` are never listed.

## "This folder overlaps with another library"

Library folders cannot contain each other. Use one library with excluded
folders, or pick sibling folders.

## Works are missing after a scan

- Only `.zip`/`.cbz` archives and folders that directly contain images are
  works. RAR, 7z, and PDF are not supported yet.
- A folder that contains images is one work; sub-folders inside it are not
  scanned. Move chapter folders so that they are not inside an image folder.
- Check the excluded folders of the library.
- Archives that cannot be opened are skipped and logged:
  `make docker-logs` or `docker compose logs mangayomi`.

## Authors or series look wrong

Open the library under **Settings → Libraries → Edit** and run **Preview**.
Adjust the folder pattern, for example `{ignore}/{author}/{series}` when an
extra folder level sits above the authors. Saving rescans and relabels works
without losing progress.

## The scan failed with "library path unavailable"

The library folder could not be read, usually because the NAS share is not
mounted. The index is left untouched. Fix the mount and scan again.

## A cover shows a placeholder

The first page could not be decoded (for example AVIF) or the file is damaged.
Pages remain readable in the reader if the browser supports the format.

## Deleting fails with "permission denied"

`/data` is mounted read-only or `PUID:PGID` cannot write to that folder. The
failed items are listed in the notification and nothing else is removed.

## "The confirmation expired"

Deletion confirmations are valid for ten minutes and are lost when the server
restarts. Review the deletion again.

## Forgot the password

```sh
docker compose exec -u <PUID>:<PGID> mangayomi /app/mangayomi reset-password
```

Then open the web UI and set a new password.

## The app looks outdated after an upgrade

The service worker updates on the next visit and reloads the page. If a stale
version persists, reload once more or clear the site data for the instance.
