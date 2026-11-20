#!/bin/sh
# Dumps the database to the backups bucket. Run daily by cuentalibre-backup.timer.
# The bucket keeps each dump for 30 days (object lock and a lifecycle rule).
#
# The dump is encrypted with age to the public keys in backup-recipients.txt
# before it leaves the server. The private key is kept off the server, so the
# bucket keys alone can't read the backups.
#
# With BACKUP_HEARTBEAT_URL set, it pings that URL when the dump is uploaded and
# `<url>/fail` when something fails, so a missed or failed night raises an alert.
#
# Restore: with a key that can read the bucket and the private key at hand,
#   rclone cat s3:<bucket>/postgres/<name>.dump.age | age -d -i backup.key > dump
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

if ! grep -q '^age1' backup-recipients.txt 2>/dev/null; then
  echo "backup-recipients.txt has no age public key; refusing to upload an unencrypted dump" >&2
  exit 1
fi

name="postgres/cuentalibre-$(date -u +%Y-%m-%dT%H%M%SZ).dump.age"

# sh has no pipefail: a failed step is noted in a file, or rclone would upload an empty dump.
# The bucket key can only write, so rclone mustn't check the bucket or read the object back.
failed=$(mktemp)
{ docker compose exec -T postgres pg_dump -U cuentalibre --format=custom cuentalibre || echo pg_dump >> "$failed"; } |
  { age -R backup-recipients.txt || echo age >> "$failed"; } |
  docker run --rm -i \
    -e RCLONE_CONFIG_S3_TYPE=s3 \
    -e RCLONE_CONFIG_S3_PROVIDER=Other \
    -e RCLONE_CONFIG_S3_ENDPOINT="$BACKUP_ENDPOINT" \
    -e RCLONE_CONFIG_S3_REGION="$BACKUP_REGION" \
    -e RCLONE_CONFIG_S3_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$BACKUP_SECRET_ACCESS_KEY" \
    -e RCLONE_S3_NO_CHECK_BUCKET=true \
    -e RCLONE_S3_NO_HEAD=true \
    rclone/rclone:1.71.2 rcat "s3:$BACKUP_BUCKET/$name"

if [ -s "$failed" ]; then
  echo "$(tr '\n' ' ' < "$failed")failed; $BACKUP_BUCKET/$name is incomplete" >&2
  rm -f "$failed"
  exit 1
fi
rm -f "$failed"

trap - EXIT
heartbeat ""
echo "Backed up to $BACKUP_BUCKET/$name"
