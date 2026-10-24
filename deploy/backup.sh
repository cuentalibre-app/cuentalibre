#!/bin/sh
# Dumps the database to the backups bucket. Run daily by cuentalibre-backup.timer.
# The bucket keeps each dump for 30 days (object lock and a lifecycle rule).
#
# With BACKUP_HEARTBEAT_URL set, it pings that URL when the dump is uploaded and
# `<url>/fail` when something fails, so a missed or failed night raises an alert.
#
# Restore: rclone cat the dump, then
#   docker compose exec -T postgres pg_restore -U cuentalibre -d cuentalibre --clean --if-exists < dump
set -eu
cd "$(dirname "$0")"
set -a
. ./backup.env
set +a

heartbeat() {
  [ -z "${BACKUP_HEARTBEAT_URL:-}" ] || curl -fsS -m 10 --retry 3 -o /dev/null "$BACKUP_HEARTBEAT_URL$1" || true
}
trap 'heartbeat /fail' EXIT

name="postgres/cuentalibre-$(date -u +%Y-%m-%dT%H%M%SZ).dump"

# sh has no pipefail: a failed dump is noted in a file, or rclone would upload an empty one.
dump_failed=$(mktemp)
{ docker compose exec -T postgres pg_dump -U cuentalibre --format=custom cuentalibre || echo failed > "$dump_failed"; } |
  docker run --rm -i \
    -e RCLONE_CONFIG_S3_TYPE=s3 \
    -e RCLONE_CONFIG_S3_PROVIDER=Other \
    -e RCLONE_CONFIG_S3_ENDPOINT="$BACKUP_ENDPOINT" \
    -e RCLONE_CONFIG_S3_REGION="$BACKUP_REGION" \
    -e RCLONE_CONFIG_S3_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$BACKUP_SECRET_ACCESS_KEY" \
    rclone/rclone:1.71.2 rcat "s3:$BACKUP_BUCKET/$name"

if [ -s "$dump_failed" ]; then
  rm -f "$dump_failed"
  echo "pg_dump failed; $BACKUP_BUCKET/$name is incomplete" >&2
  exit 1
fi
rm -f "$dump_failed"

trap - EXIT
heartbeat ""
echo "Backed up to $BACKUP_BUCKET/$name"
