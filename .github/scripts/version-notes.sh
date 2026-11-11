#!/usr/bin/env bash
# Prints the CHANGELOG.md section for the version in package.json at a commit, and fails
# when there is none, so CI stops a version bump that forgets its notes.
#
#   .github/scripts/version-notes.sh [commit]
set -euo pipefail

commit=${1:-HEAD}
version=$(git show "$commit:package.json" | jq -r .version)
notes=$(git show "$commit:CHANGELOG.md" | awk -v v="$version" '
  /^## / { if (found) exit; found = ($2 == v); next }
  found')

if [ -z "$(printf '%s' "$notes" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md has no notes under '## $version', the version in package.json" >&2
  exit 1
fi
printf '%s\n' "$notes"
