#!/bin/sh
# Nightly backup of the database and the encrypted document volume.
#
#   crontab -e
#   30 2 * * *  /srv/bcnstudent/deploy/backup.sh >> /var/log/bcnstudent-backup.log 2>&1
#
# Both artifacts contain only ciphertext for personal data — PROVIDED the .env
# file (which holds the master key) is never copied alongside them. This script
# deliberately does not back it up; keep the key in a password manager instead.
set -eu

cd "$(dirname "$0")/.."
DEST="${BACKUP_DIR:-/var/backups/bcnstudent}"
# Keep backups no longer than the retention promised in the privacy notice:
# a case erased after 30 days must not live on in a year-old backup.
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

umask 077
mkdir -p "$DEST"

docker compose exec -T db pg_dump -U bcn -d bcn --format=custom > "$DEST/db-$STAMP.dump"
# Encrypted uploads are a bind mount (./data) since the move to a host-level
# proxy; no container is needed to read them.
tar czf "$DEST/documents-$STAMP.tar.gz" -C "${DATA_DIR:-./data}" .

find "$DEST" -type f \( -name 'db-*.dump' -o -name 'documents-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) backup ok: db-$STAMP.dump documents-$STAMP.tar.gz"
