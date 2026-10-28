#!/usr/bin/env bash
# Tags the commit an app runs in production as `prod-<app>-<date>`, with `.2`, `.3`…
# for later releases the same day, and pushes the tag.
#
#   .github/scripts/tag-release.sh <api|web> <commit>
set -euo pipefail

app=${1:?usage: tag-release.sh <app> <commit>}
commit=${2:?usage: tag-release.sh <app> <commit>}
base="prod-$app-$(TZ=Europe/Madrid date +%Y.%m.%d)"

git fetch --quiet --tags origin
tag=$base
n=1
while git rev-parse --quiet --verify "refs/tags/$tag" >/dev/null; do
  n=$((n + 1))
  tag="$base.$n"
done

git tag "$tag" "$commit"
git push --quiet origin "refs/tags/$tag"
echo "Tagged $commit as $tag"
