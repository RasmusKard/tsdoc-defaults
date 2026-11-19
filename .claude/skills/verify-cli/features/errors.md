# Tag errors

A tag the CLI can't turn into code, such as a code span that isn't one expression, fails the run: exit 1, one `file:line:col <Decl>.<member>: <reason>` line per error on stderr, and nothing written, not even for the other sources.

## Sub-features

- `err-report` prints each error as `file:line:col`.
- `err-nothing-written` leaves every generated file as it was.
- `err-check` reports the same errors under `--check`.
- `err-usage` exits 2 for a usage error or no files to read.

## How to get to it (user POV)

- Run `tsdoc-defaults` or `tsdoc-defaults --check` over a source with a bad tag.
- Run `tsdoc-defaults --bogus` or `tsdoc-defaults 'nothing/*.ts'`.

## Driving it with verify.sh

Preconditions:

- Baseline from the [index](./README.md).

- **Good state.** Run `$V run 01-generate tsdoc-defaults`. Exit 0; `./src/options.defaults.ts` holds `timeoutMs: 10_000`.
- **Break a tag and edit a good one.** Run `$V run 02-bad sh -c "printf 'export interface Bad {\n  /** @default \`{ a:\` */\n  x?: number;\n}\n' > src/bad.ts"`, then `$V run 03-edit sed -i '' 's/`10_000`/`20_000`/' src/options.ts`.
- **Report.** Run `$V run 04-errors tsdoc-defaults`. Exit 1; stderr is `src/bad.ts:2:7 Bad.x: the code in the default tag is not one expression`; the file list has no `bad.defaults.ts` and `options.defaults.ts` still holds `timeoutMs: 10_000`.
- **Under --check.** Run `$V run 05-errors-check tsdoc-defaults --check`. Exit 1, same stderr line.
- **Usage.** Run `$V run 06-usage tsdoc-defaults --bogus` and `$V run 07-no-files tsdoc-defaults 'nothing/*.ts'`. Both exit 2: the first prints the option error and the usage line, the second `no files match`.

## Gotchas

- An unclosed code span (`` @default `{ a: 1 ``) and a non-expression are different errors with different messages; the README's tag table lists them.
- The column points at the tag, not the member name.
