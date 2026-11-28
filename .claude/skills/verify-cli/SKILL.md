---
name: verify-cli
description: Prove a tsdoc-defaults change works the way a consumer sees it, by running the built `tsdoc-defaults` CLI, the generated `DEFAULTS` module and the TypeDoc plugin in a disposable TypeScript project. Use after changing src/, before calling a CLI, codegen, `--check`, error or TypeDoc change done.
---

# Verify tsdoc-defaults as a consumer

The product is a CLI, `tsdoc-defaults`, plus the module it generates and a TypeDoc plugin. A consumer touches three things: the command's exit code and messages, the `<name>.defaults.ts` file it writes, and `tsc`/`node`/`typedoc` running over that file. Unit tests (`pnpm test`) call the source through `tsx`; this skill drives the **built** `dist/` from a separate project, the way an installed package runs.

Everything goes through [`verify.sh`](verify.sh), run from the repo root. Each run has an ID; every command needs it.

```sh
export RUN_ID=$(date +%Y%m%d-%H%M%S) V=.claude/skills/verify-cli/verify.sh
```

## Launch

```sh
$V launch
```

Builds `dist/` (`pnpm run build`), then creates the consumer project at `$TMPDIR/tsdoc-defaults-verify-$RUN_ID`:

- `package.json` (`"type": "module"`), `tsconfig.json` (`module: nodenext`, so generated imports end in `.js`).
- `src/options.ts`: `ClientOptions` with `timeoutMs` (`` @default `10_000` ``), `retries` (`@defaultValue 3`), `cacheDir` (`` @default `os.tmpdir()` `` with a `// tsdoc-defaults: import` directive) and `baseUrl` (prose default).
- `src/client.ts`: reads `DEFAULTS.ClientOptions.timeoutMs` from `./options.defaults.js`, so it fails `tsc` until the file is generated.
- `bin/tsdoc-defaults`: runs `node <repo>/dist/cli.js`. `run` puts it first on `PATH`, then the repo's `node_modules/.bin` (`tsc`, `typedoc`, `prettier`).

Ready when it prints `ready: project …, evidence …`. Launch refuses an ID that already has a project; pick a new `RUN_ID`. Runs with different IDs are independent.

## Doctor

```sh
$V doctor
```

Read-only. Prints `OK` and exits 0 only when the project exists, `dist/cli.js` is newer than every `src/*.ts`, and `tsdoc-defaults --help` prints the usage line. It also prints the repo commit and package version. Run it first, and again whenever a result looks wrong: a stale `dist/` is the usual cause. Fix by rerunning `pnpm run build`.

## Drive

```sh
$V run <label> <command> [args...]
```

Runs the command in the project directory and writes `.scratch/verify/$RUN_ID/<label>.txt` with the exact command, its exit code, stdout, stderr, the project's file list and the content of every `*.defaults.*` file after it ran. It also prints that record. `run` itself always exits 0; read `exit:` in the record.

Prefix labels with a number (`01-generate`) so the evidence reads in order. Change sources with `run` too (`$V run 05-edit sed -i '' 's/…/…/' src/options.ts`), so the edit is part of the record.

The feature recipes are in [`features/`](features/README.md). Each lists every user entry point; a proof that drives one of them doesn't cover the others.

## Evidence

Evidence lives in `.scratch/verify/$RUN_ID/` (gitignored): `commit.txt` (HEAD and dirty files at launch) and one record per `run`. A proof:

- Drives the user path: the `tsdoc-defaults` command, `tsc`, `node`, `typedoc` over the project. Never calls `generate`/`check` from `src/` directly; that's what `pnpm test` does.
- Captures before and after: the command that changes state, then a second command that reads it (`--check`, `tsc`, `node`, the HTML). An exit code 0 alone proves nothing about the file.
- Checks side effects on disk: which files exist after the run, not only what was printed. An error run must leave the file list unchanged.
- Uses no mocks. Everything runs locally; nothing touches the network.

Report each feature ID with the label of the record that proves it.

## Cleanup

```sh
$V cleanup
```

Removes only `$TMPDIR/tsdoc-defaults-verify-$RUN_ID`. Evidence in `.scratch/verify/$RUN_ID/` stays. `dist/` stays too (it's gitignored and the next `pnpm run build` replaces it). Run cleanup after every run, failed ones included.
