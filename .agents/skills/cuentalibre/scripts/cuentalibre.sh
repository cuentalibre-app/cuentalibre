#!/usr/bin/env bash
# Calls the cuentalibre API with the key from the environment.
#
#   cuentalibre.sh GET /organization
#   cuentalibre.sh GET '/expenses?from=2026-10-01&to=2026-12-31'
#   cuentalibre.sh POST /expenses @expense.json      # JSON body from a file
#   echo '{"privateNotes":"Revisado"}' | cuentalibre.sh PATCH /expenses/<id> @-
#   cuentalibre.sh UPLOAD ticket.pdf                  # POST /files as multipart
#
# Prints the response body to stdout and "HTTP <status>" to stderr; exits 1 on
# any status of 400 or above.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi
: "${CUENTALIBRE_API_KEY:?Set CUENTALIBRE_API_KEY to a key from Configuración › API y agentes}"
base="${CUENTALIBRE_API_URL:-https://api.cuentalibre.es/v1}"
base="${base%/}"

method="$1"
target="$2"
body="${3:-}"

args=(-sS -H "Authorization: Bearer ${CUENTALIBRE_API_KEY}" -w '\n%{http_code}')
if [[ "$method" == "UPLOAD" ]]; then
  args+=(-X POST -F "file=@${target}")
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
