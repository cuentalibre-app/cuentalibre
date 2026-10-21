#!/bin/sh
# Dumps the database to the backups bucket. Run daily by cuentalibre-backup.timer.
# The bucket keeps each dump for 30 days (object lock and a lifecycle rule).
#
# Restore: rclone cat the dump, then
#   docker compose exec -T postgres pg_restore -U cuentalibre -d cuentalibre --clean --if-exists < dump
set -eu
cd "$(dirname "$0")"
set -a
. ./.env
set +a

name="postgres/cuentalibre-$(date -u +%Y-%m-%dT%H%M%SZ).dump"

docker compose exec -T postgres pg_dump -U cuentalibre --format=custom cuentalibre |
  docker run --rm -i \
    -e RCLONE_CONFIG_S3_TYPE=s3 \
    -e RCLONE_CONFIG_S3_PROVIDER=Other \
    -e RCLONE_CONFIG_S3_ENDPOINT="$S3_ENDPOINT" \
    -e RCLONE_CONFIG_S3_REGION="$S3_REGION" \
    -e RCLONE_CONFIG_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    rclone/rclone:1.71.2 rcat "s3:$BACKUP_BUCKET/$name"

echo "Backed up to $BACKUP_BUCKET/$name"
