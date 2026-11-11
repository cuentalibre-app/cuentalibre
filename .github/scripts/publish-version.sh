#!/usr/bin/env bash
# Publishes the commit production now runs as the next version for self-hosters: tags it
# `v<version>`, creates a GitHub Release with what CHANGELOG.md lists under "Próxima versión"
# at that commit, and commits the changelog with that section under the version to main.
#
#   .github/scripts/publish-version.sh <patch|minor|major> <commit>
set -euo pipefail

bump=${1:?usage: publish-version.sh <patch|minor|major> <commit>}
commit=${2:?usage: publish-version.sh <patch|minor|major> <commit>}
scripts=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)

git fetch --quiet --tags origin
last=$(git tag -l 'v*' --sort=-v:refname | head -n1)
IFS=. read -r major minor patch <<<"${last#v}"
case $bump in
  major) version="$((major + 1)).0.0" ;;
  minor) version="$major.$((minor + 1)).0" ;;
  patch) version="$major.$minor.$((patch + 1))" ;;
  *) echo "Unknown bump: $bump" >&2; exit 1 ;;
esac

# Promoting again what's already out, e.g. after a failed run, publishes nothing
if git diff --quiet "$last" "$commit" -- . ':(exclude)CHANGELOG.md'; then
  echo "$commit has nothing new since $last"
  exit 0
fi

git show "$commit:CHANGELOG.md" > "$tmp/CHANGELOG.md"
node "$scripts/changelog.mjs" notes "$tmp/CHANGELOG.md" > "$tmp/shipped.md"
if [ -s "$tmp/shipped.md" ]; then cp "$tmp/shipped.md" "$tmp/notes.md"; else echo "Correcciones y mejoras internas." > "$tmp/notes.md"; fi

gh release create "v$version" --target "$commit" --title "v$version" --notes-file "$tmp/notes.md"
echo "Published v$version (was $last)"

# On main's latest commit: lines merged after the promoted commit stay under Próxima versión
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
date=$(TZ=Europe/Madrid date +%Y-%m-%d)
for attempt in 1 2 3; do
  git fetch --quiet origin main
  git checkout --quiet -B release-changelog origin/main
  node "$scripts/changelog.mjs" release CHANGELOG.md "$version" "$date" "$tmp/shipped.md"
  git commit --quiet -am "Release v$version"
  git push --quiet origin HEAD:main && exit 0
  echo "main moved while releasing, trying again ($attempt)" >&2
done
echo "Couldn't commit CHANGELOG.md for v$version to main" >&2
exit 1
