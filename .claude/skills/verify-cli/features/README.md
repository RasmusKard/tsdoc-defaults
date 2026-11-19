# tsdoc-defaults verification map

The maintained source for verifying what a tsdoc-defaults consumer sees. Read this index, then use the matching feature file as the recipe.

## Baseline preconditions

- `RUN_ID` and `V` are exported as in [the skill](../SKILL.md), and `$V launch` printed `ready`.
- `$V doctor` prints `OK`.
- The project holds the seed files only: no `*.defaults.ts`, no edits to `src/options.ts`.
- Never drive a project another `RUN_ID` created.

## Driving conventions

- Run every command, including source edits, through `$V run <label> …` from the repo root.
- Treat commands as literal. Keep quoting and flags unchanged.
- Recipes build on each other in the order listed inside a file. Between files, launch a fresh `RUN_ID` or undo the file's edits.

## Proof and skip reporting

- CLI proof is the record: command, exit code, stdout, stderr, file list, generated content.
- A state change is proven by a second, read-only command (`--check`, `tsc`, `node`, the rendered HTML).
- Name the feature ID and record label with every claim.
- Report an unreachable path with the attempted command and the unmet precondition. Don't count a skipped entry point as verified through another.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior, then exactly these H2s in order:

1. `Sub-features`: short IDs, one line each.
2. `How to get to it (user POV)`: every entry point.
3. `Driving it with verify.sh`: `Preconditions:`, then labeled bullets pairing an action with an exact command and the observable result.
4. `Gotchas`: traps that waste or invalidate a run.

## Features

- [Generate defaults](./generate.md): `tsdoc-defaults` writes a typed `DEFAULTS` module that compiles and runs.
- [Check for stale files](./check.md): `--check` fails on an edited tag and ignores formatting.
- [Tag errors](./errors.md): a bad tag exits 1 with `file:line:col` and writes nothing.
- [TypeDoc plugin](./typedoc.md): code defaults render in the signature, prose stays a Default block.
