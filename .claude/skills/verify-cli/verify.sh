#!/usr/bin/env bash
# Drives the built tsdoc-defaults CLI in a disposable consumer project and records evidence.
# Usage: RUN_ID=<id> verify.sh launch|doctor|run <label> <command...>|cleanup
set -euo pipefail

REPO=$(cd "$(dirname "$0")/../../.." && pwd)
RUN_ID=${RUN_ID:?set RUN_ID first, e.g. export RUN_ID=\$(date +%Y%m%d-%H%M%S)}
WORK=${TMPDIR:-/tmp}
WORK=${WORK%/}/tsdoc-defaults-verify-$RUN_ID
EVIDENCE=$REPO/.scratch/verify/$RUN_ID

seed() {
  mkdir -p "$WORK/src" "$WORK/bin"
  # The user's entry point: `tsdoc-defaults` on PATH, running this checkout's build.
  printf '#!/bin/sh\nexec node "%s/dist/cli.js" "$@"\n' "$REPO" >"$WORK/bin/tsdoc-defaults"
  chmod +x "$WORK/bin/tsdoc-defaults"
  echo '{ "name": "verify-consumer", "private": true, "type": "module" }' >"$WORK/package.json"
  cat >"$WORK/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "strict": true,
    "target": "es2022",
    "module": "nodenext",
    "types": ["node"],
    "typeRoots": ["__REPO__/node_modules/@types"],
    "noEmit": true
  },
  "include": ["src"]
}
EOF
  sed -i.bak "s#__REPO__#$REPO#" "$WORK/tsconfig.json" && rm "$WORK/tsconfig.json.bak"
  cat >"$WORK/src/options.ts" <<'EOF'
// tsdoc-defaults: import os from 'node:os'
/** Options for an HTTP client. */
export interface ClientOptions {
  /**
   * Request timeout in milliseconds.
   * @default `10_000`
   */
  timeoutMs?: number;
  /** @defaultValue 3 */
  retries?: number;
  /** @default `os.tmpdir()` */
  cacheDir?: string;
  /** @default the origin of the current page */
  baseUrl?: string;
}
EOF
  cat >"$WORK/src/client.ts" <<'EOF'
import type { ClientOptions } from './options.js';
import { DEFAULTS } from './options.defaults.js';

export const timeoutOf = (opts: ClientOptions): number =>
  opts.timeoutMs ?? DEFAULTS.ClientOptions.timeoutMs;
EOF
}

case ${1:-} in
launch)
  [[ -e $WORK ]] && { echo "already launched: $WORK" >&2; exit 1; }
  (cd "$REPO" && npm run build --silent)
  seed
  mkdir -p "$EVIDENCE"
  git -C "$REPO" rev-parse HEAD >"$EVIDENCE/commit.txt"
  git -C "$REPO" status --short >>"$EVIDENCE/commit.txt"
  echo "ready: project $WORK, evidence $EVIDENCE"
  ;;
doctor)
  ok=1
  [[ -d $WORK/src ]] || { echo "FAIL no project at $WORK: run launch"; ok=0; }
  if [[ -f $REPO/dist/cli.js ]]; then
    stale=$(find "$REPO/src" -name '*.ts' -newer "$REPO/dist/cli.js" | head -1)
    [[ -z $stale ]] || { echo "FAIL dist is older than $stale: rerun launch"; ok=0; }
  else
    echo "FAIL $REPO/dist/cli.js missing: run launch"; ok=0
  fi
  help=$("$WORK/bin/tsdoc-defaults" --help 2>&1) && [[ $help == usage:* ]] ||
    { echo "FAIL tsdoc-defaults --help: $help"; ok=0; }
  echo "repo $REPO @ $(git -C "$REPO" rev-parse --short HEAD), package $(node -p "require('$REPO/package.json').version")"
  echo "project $WORK, evidence $EVIDENCE"
  ((ok)) && echo OK || exit 1
  ;;
run)
  label=${2:?label}
  shift 2
  out=$EVIDENCE/$label.txt
  set +e
  (cd "$WORK" && PATH="$WORK/bin:$REPO/node_modules/.bin:$PATH" "$@") >"$out.stdout" 2>"$out.stderr"
  code=$?
  set -e
  {
    echo "$ $(printf "%q " "$@")"
    echo "exit: $code"
    echo "--- stdout"; cat "$out.stdout"
    echo "--- stderr"; cat "$out.stderr"
    echo "--- project files"
    (cd "$WORK" && find . \( -path ./bin -o -path ./docs \) -prune -o -type f -print | sort)
    for f in $(cd "$WORK" && find . -name '*.defaults.*' | sort); do
      echo "--- $f"; cat "$WORK/$f"
    done
  } >"$out"
  rm "$out.stdout" "$out.stderr"
  cat "$out"
  ;;
cleanup)
  rm -rf "$WORK"
  echo "removed $WORK; evidence kept in $EVIDENCE"
  ;;
*)
  sed -n 3p "$0" >&2
  exit 2
  ;;
esac
