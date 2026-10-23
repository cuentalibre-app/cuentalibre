#!/usr/bin/env bash
# Calls the cuentalibre API with the key from the environment or the skill's .env.
#
#   cuentalibre.sh GET /organization
#   cuentalibre.sh GET '/expenses?from=2026-10-01&to=2026-12-31'
#   cuentalibre.sh POST /expenses @expense.json      # JSON body from a file
#   echo '{"privateNotes":"Revisado"}' | cuentalibre.sh PATCH /expenses/<id> @-
#   cuentalibre.sh UPLOAD ticket.pdf <uuid>           # POST /files as multipart
#
# Prints the response body to stdout and "HTTP <status>" to stderr; exits 1 on
# any status of 400 or above.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi

# Load CUENTALIBRE_* variables from the .env next to SKILL.md. It is parsed,
# not sourced, and variables already set in the environment win.
env_file="$(cd "$(dirname "$0")/.." && pwd)/.env"
assignment='^[[:space:]]*(export[[:space:]]+)?(CUENTALIBRE_[A-Z_]+)[[:space:]]*=[[:space:]]*(.*)$'
double_quoted='^"(.*)"$'
single_quoted="^'(.*)'$"
if [[ -f "$env_file" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ $assignment ]] || continue
    name="${BASH_REMATCH[2]}"
    value="${BASH_REMATCH[3]}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" =~ $double_quoted || "$value" =~ $single_quoted ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    if [[ -z "${!name:-}" && -n "$value" ]]; then
      export "$name=$value"
    fi
  done <"$env_file"
fi

: "${CUENTALIBRE_API_KEY:?Set CUENTALIBRE_API_KEY in .env next to SKILL.md (see .env.example) or in the environment}"
base="${CUENTALIBRE_API_URL:-https://api.cuentalibre.es/v1}"
base="${base%/}"

method="$1"
target="$2"
body="${3:-}"

args=(-sS -H "Authorization: Bearer ${CUENTALIBRE_API_KEY}" -w '\n%{http_code}')
if [[ "$method" == "UPLOAD" ]]; then
  args+=(-X POST -F "file=@${target}")
  # With an id, a retried upload answers 409 already_exists instead of storing the file twice.
  if [[ -n "$body" ]]; then
    args+=(--form-string "id=${body}")
  fi
  url="${base}/files"
else
  [[ "$target" == /* ]] || target="/${target}"
  args+=(-X "$method")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data-binary "$body")
  fi
  url="${base}${target}"
fi

response="$(curl "${args[@]}" "$url")"
status="${response##*$'\n'}"
printf '%s\n' "${response%$'\n'*}"
echo "HTTP ${status}" >&2
[[ "$status" -lt 400 ]]
