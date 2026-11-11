#!/usr/bin/env bash
# Publishes the version in package.json as a release for self-hosters, tagged `v<version>`
# with its CHANGELOG.md section as notes. Only on a commit that both the API and the web app
# run in production, since the self-hosted image bundles both, and only once per version.
#
#   .github/scripts/publish-version.sh <commit>...
set -euo pipefail

git fetch --quiet --tags origin
for commit in "$@"; do
  if ! git tag --points-at "$commit" -l 'prod-api-*' | grep -q . ||
    ! git tag --points-at "$commit" -l 'prod-web-*' | grep -q .; then
    echo "Production doesn't run $commit in both apps yet"
    continue
  fi
  version=$(git show "$commit:package.json" | jq -r .version)
  if git rev-parse --quiet --verify "refs/tags/v$version" >/dev/null; then
    echo "v$version is already out"
    exit 0
  fi
  .github/scripts/version-notes.sh "$commit" > "$RUNNER_TEMP/notes.md"
  gh release create "v$version" --target "$commit" --title "v$version" --notes-file "$RUNNER_TEMP/notes.md"
  exit 0
done
