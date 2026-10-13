#!/bin/sh
set -eu
umask 077
# Only this mounted data directory is initialized; application code stays read-only.
mkdir -p /var/lib/heritage/uploads /var/lib/heritage/backups
chown node:node /var/lib/heritage /var/lib/heritage/uploads /var/lib/heritage/backups
exec su -s /bin/sh node -c 'exec node /app/server.js'
