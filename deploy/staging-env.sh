#!/usr/bin/env bash
# Writes staging's settings from the `staging` GitHub environment, so nobody edits them
# on the server: `.env.staging` for the API and `.env.staging-postgres` for its database.
# Takes the environment's variables and secrets as JSON (`toJSON(vars)`, `toJSON(secrets)`)
# in SETTINGS and SECRETS, and keeps only the names `deploy/.env.example` lists.
#
#   SETTINGS='{...}' SECRETS='{...}' deploy/staging-env.sh <output directory>
set -euo pipefail

out=${1:?usage: staging-env.sh <output directory>}
here=$(dirname "$0")
names=$(sed -nE 's/^#? ?([A-Z][A-Z0-9_]*)=.*/\1/p' "$here/.env.example" | grep -vx API_IMAGE | jq -R . | jq -s .)
none='{}'
settings=$(jq -n --argjson vars "${SETTINGS:-$none}" --argjson secrets "${SECRETS:-$none}" --argjson names "$names" \
  '$vars + $secrets | with_entries(select(.key as $name | $names | index($name)) | select(.value != ""))')

get() { jq -r --arg name "$1" '.[$name] // empty' <<<"$settings"; }
fail() { echo "staging-env: $*" >&2; exit 1; }

for name in API_DOMAIN WEB_ORIGIN POSTGRES_PASSWORD BETTER_AUTH_SECRET; do
  [ -n "$(get "$name")" ] || fail "$name is missing from the staging environment"
done
# Nothing real leaves staging: no live charges, and no email to anyone but the owner
case $(get STRIPE_SECRET_KEY) in sk_live_* | rk_live_*) fail "STRIPE_SECRET_KEY is a live key" ;; esac
[ -z "$(get SMTP_URL)" ] || [ -n "$(get EMAIL_REDIRECT_TO)" ] || fail "SMTP_URL needs EMAIL_REDIRECT_TO in staging"
# Compose reads single-quoted values as they are, with no way to escape a quote
jq -e 'all(.[]; (contains("'"'"'") or contains("\n")) | not)' <<<"$settings" >/dev/null ||
  fail "a value holds a single quote or a line break"

password=$(get POSTGRES_PASSWORD)
umask 077
mkdir -p "$out"
{
  jq -r 'del(.POSTGRES_PASSWORD) | to_entries[] | "\(.key)='"'"'\(.value)'"'"'"' <<<"$settings"
  echo "DATABASE_URL='postgres://cuentalibre:$(jq -rn --arg p "$password" '$p | @uri')@postgres-staging:5432/cuentalibre'"
  echo "BETTER_AUTH_URL='https://$(get API_DOMAIN)'"
} >"$out/.env.staging"
echo "POSTGRES_PASSWORD='$password'" >"$out/.env.staging-postgres"
