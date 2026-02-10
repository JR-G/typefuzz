#!/usr/bin/env bash
set -euo pipefail

git checkout main
git pull

version=$(node -p "require('./package.json').version")
tag="v$version"

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Error: tag $tag already exists"
  exit 1
fi

git tag "$tag"
git push origin "$tag"

echo "Tagged and pushed $tag — publish workflow will handle the rest"
