#!/usr/bin/env bash
set -euo pipefail

bump=${1:?"Usage: bun run release <patch|minor|major>"}

if [[ "$bump" != "patch" && "$bump" != "minor" && "$bump" != "major" ]]; then
  echo "Error: argument must be patch, minor, or major"
  exit 1
fi

current=$(node -p "require('./package.json').version")
if [[ ! "$current" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: invalid version '$current' in package.json (expected major.minor.patch)"
  exit 1
fi
IFS='.' read -r major minor patch <<< "$current"

case "$bump" in
  patch) patch=$((patch + 1)) ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  major) major=$((major + 1)); minor=0; patch=0 ;;
esac

version="$major.$minor.$patch"
branch="release/v$version"

git checkout -b "$branch"

node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$version';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

git add package.json
git commit -m "v$version"
git push -u origin "$branch"
gh pr create --title "v$version" --body "Bump version to $version" --auto --rebase

echo "Created release PR for v$version"
echo "After merge, run: bun run release:tag $version"
