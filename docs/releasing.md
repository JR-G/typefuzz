# Releasing

This repository uses helper scripts to create version bump PRs and publish tags.

## 1. Create a release PR

Run one of:

```sh
bun run release patch
bun run release minor
bun run release major
```

What this script does (`scripts/release.sh`):

1. Validates bump type (`patch|minor|major`).
2. Computes next SemVer from `package.json`.
3. Creates a new branch: `release/vX.Y.Z`.
4. Updates `package.json` version.
5. Commits (`vX.Y.Z`), pushes branch, and opens a PR.

## 2. Merge release PR

After CI and review pass, merge the release PR.

## 3. Tag main to publish

After merge, run:

```sh
bun run release:tag
```

What this script does (`scripts/release-tag.sh`):

1. Checks out `main` and pulls latest.
2. Reads version from `package.json`.
3. Creates tag `vX.Y.Z` if it does not already exist.
4. Pushes the tag to `origin`.

Pushing the tag triggers the publish workflow.
