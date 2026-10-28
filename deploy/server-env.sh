#!/usr/bin/env bash
# Writes a server's settings from its GitHub environment (`staging` or `production`), so
# nobody edits them on the server: `.env` with the names `deploy/.env.example` lists, and
# `backup.env` with those in `deploy/backup.env.example` (only when BACKUP_BUCKET is set).
# Takes the environment's variables and secrets as JSON (`toJSON(vars)`, `toJSON(secrets)`)
# in SETTINGS and SECRETS, and the image the server runs as its third argument.
#
#   SETTINGS='{...}' SECRETS='{...}' deploy/server-env.sh <environment> <output directory> <image>
set -euo pipefail

usage='usage: server-env.sh <staging|production> <output directory> <image>'
environment=${1:?$usage}
out=${2:?$usage}
image=${3:?$usage}
case $environment in staging | production) ;; *) echo "$usage" >&2; exit 1 ;; esac
here=$(dirname "$0")
none='{}'
all=$(jq -n --argjson vars "${SETTINGS:-$none}" --argjson secrets "${SECRETS:-$none}" '$vars + $secrets')

# The names an example file lists, set or commented out, with the values the environment has for them
pick() {
  local names
  names=$(sed -nE 's/^#? ?([A-Z][A-Z0-9_]*)=.*/\1/p' "$1" | grep -vx API_IMAGE | jq -R . | jq -s .)
  jq --argjson names "$names" 'with_entries(select(.key as $name | $names | index($name)) | select(.value != ""))' <<<"$all"
}
settings=$(pick "$here/.env.example")
backup=$(pick "$here/backup.env.example")

get() { jq -r --arg name "$1" '.[$name] // empty' <<<"$settings"; }
fail() { echo "server-env: $*" >&2; exit 1; }

for name in API_DOMAIN WEB_ORIGIN POSTGRES_PASSWORD BETTER_AUTH_SECRET; do
  [ -n "$(get "$name")" ] || fail "$name is missing from the $environment environment"
done
if [ "$environment" = staging ]; then
  # Nothing real leaves staging: no live charges, and no email to anyone but the owner
  case $(get STRIPE_SECRET_KEY) in sk_live_* | rk_live_*) fail "STRIPE_SECRET_KEY is a live key" ;; esac
  [ -z "$(get SMTP_URL)" ] || [ -n "$(get EMAIL_REDIRECT_TO)" ] || fail "SMTP_URL needs EMAIL_REDIRECT_TO in staging"
else
  # Users' email would all go to one address
  [ -z "$(get EMAIL_REDIRECT_TO)" ] || fail "EMAIL_REDIRECT_TO is for staging only"
fi
# Compose and sh read single-quoted values as they are, with no way to escape a quote
jq -e -s 'add | all(.[]; (contains("'"'"'") or contains("\n")) | not)' <<<"$settings $backup" >/dev/null ||
  fail "a value holds a single quote or a line break"

lines() { jq -r 'to_entries[] | "\(.key)='"'"'\(.value)'"'"'"'; }
umask 077
mkdir -p "$out"
{
  lines <<<"$settings"
  echo "API_IMAGE='$image'"
} >"$out/.env"
if [ "$(jq -r '.BACKUP_BUCKET // empty' <<<"$backup")" ]; then
  lines <<<"$backup" >"$out/backup.env"
fi
