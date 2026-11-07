#!/usr/bin/env bash
# Publishes a draft release's attested tarball to npm, then un-drafts the release. Usage: scripts/publish.sh 1.0.0
set -euo pipefail
version=${1:?usage: $0 X.Y.Z}
repo=RasmusKard/tsdoc-defaults
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
gh release download "v$version" -p '*.tgz' -D "$dir" -R "$repo"
gh attestation verify "$dir/tsdoc-defaults-$version.tgz" -R "$repo" \
  --signer-workflow "$repo/.github/workflows/release.yml" --source-ref refs/heads/main --deny-self-hosted-runners
npm publish "$dir/tsdoc-defaults-$version.tgz"
gh release edit "v$version" --draft=false -R "$repo"
