#!/bin/sh
# Backs up Postgres and, when configured, all uploaded file versions each night.
# The production bucket keeps each backup for 30 days under object lock.
#
# Backups are encrypted with age to the public keys in backup-recipients.txt
# before it leaves the server. The private key is kept off the server, so the
# bucket keys alone can't read the backups.
#
# With BACKUP_HEARTBEAT_URL set, it pings that URL after all uploads succeed and
# `<url>/fail` when something fails, so a missed or failed night raises an alert.
#
# Restore: with a key that can read the bucket and the private key at hand,
#   rclone cat s3:<bucket>/postgres/<name>.dump.age | age -d -i backup.key > dump
#   docker compose exec -T postgres pg_restore -U cuentalibre -d cuentalibre --clean --if-exists < dump
set -eu
cd "$(dirname "$0")"
set -a
# shellcheck source=/dev/null
. ./backup.env
set +a

heartbeat() {
  [ -z "${BACKUP_HEARTBEAT_URL:-}" ] || curl -fsS -m 10 --retry 3 -o /dev/null "$BACKUP_HEARTBEAT_URL$1" || true
}
work=
trap 'if [ -n "$work" ]; then rm -rf "$work"; fi; heartbeat /fail' EXIT

if ! grep -q '^age1' backup-recipients.txt 2>/dev/null; then
  echo "backup-recipients.txt has no age public key; refusing to run backups" >&2
  exit 1
fi

timestamp=$(date -u +%Y-%m-%dT%H%M%SZ)
work=$(mktemp -d)

backup() {
  name=$1
  shift

  # Check the producer and age before uploading anything to the locked bucket.
  # Only ciphertext is staged on disk. POSIX sh tracks the producer with a marker.
  touch "$work/incomplete"
  { "$@" && rm "$work/incomplete"; } | age -R backup-recipients.txt > "$work/encrypted"
  if [ -e "$work/incomplete" ]; then
    echo "Could not create $name" >&2
    exit 1
  fi

  # The bucket key can only write, so skip checking the bucket and reading the object back.
  docker run --rm \
    -v "$work/encrypted:/backup.age:ro" \
    -e RCLONE_CONFIG_S3_TYPE=s3 \
    -e RCLONE_CONFIG_S3_PROVIDER=Other \
    -e RCLONE_CONFIG_S3_ENDPOINT="$BACKUP_ENDPOINT" \
    -e RCLONE_CONFIG_S3_REGION="$BACKUP_REGION" \
    -e RCLONE_CONFIG_S3_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$BACKUP_SECRET_ACCESS_KEY" \
    -e RCLONE_S3_NO_CHECK_BUCKET=true \
    -e RCLONE_S3_NO_HEAD=true \
    rclone/rclone:1.71.2 copyto --no-check-dest /backup.age "s3:$BACKUP_BUCKET/$name"
  rm -f "$work/encrypted"
  echo "Backed up to $BACKUP_BUCKET/$name"
}

backup "postgres/cuentalibre-$timestamp.dump.age" \
  docker compose exec -T postgres pg_dump -U cuentalibre --format=custom cuentalibre
if [ -n "${BACKUP_FILES_BUCKET:-}" ]; then
  backup "files/cuentalibre-$timestamp.tar.age" python3 ./backup-files.py
fi

rm -rf "$work"
trap - EXIT
heartbeat ""
