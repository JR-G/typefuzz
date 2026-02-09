#!/usr/bin/env bash
set -euo pipefail

bump=${1:?"Usage: bun run release <patch|minor|major>"}

if [[ "$bump" != "patch" && "$bump" != "minor" && "$bump" != "major" ]]; then
  echo "Error: argument must be patch, minor, or major"
  exit 1
fi

current=$(node -p "require('./package.json').version")
IFS='.' read -r major minor patch <<< "$current"

case "$bump" in
  patch) patch=$((patch + 1)) ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  major) major=$((major + 1)); minor=0; patch=0 ;;
esac

version="$major.$minor.$patch"

sed -i '' "s/\"version\": \"$current\"/\"version\": \"$version\"/" package.json

git add package.json
git commit -m "v$version"
git tag "v$version"
git push && git push origin "v$version"

echo "Released v$version"
