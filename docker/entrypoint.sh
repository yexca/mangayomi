#!/bin/sh
set -e

# Run as PUID:PGID so files in /config (and deletions in /data) belong to
# the NAS user rather than root. /data is never chowned: it is user content.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$MANGAYOMI_CONFIG_DIR"
  if [ "$(stat -c %u "$MANGAYOMI_CONFIG_DIR")" != "$PUID" ] || [ "$(stat -c %g "$MANGAYOMI_CONFIG_DIR")" != "$PGID" ]; then
    chown -R "$PUID:$PGID" "$MANGAYOMI_CONFIG_DIR"
  fi
  exec su-exec "$PUID:$PGID" /app/mangayomi "$@"
fi

exec /app/mangayomi "$@"
