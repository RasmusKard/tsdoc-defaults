# Check for stale files

`tsdoc-defaults --check` writes nothing and exits 1 naming each generated file that no longer matches its tags. Formatting and comments in the generated file don't count, so Prettier may run on it.

## Sub-features

- `check-fresh` exits 0 right after generating.
- `check-stale` exits 1 and names the file after a tag edit, without writing it.
- `check-format` exits 0 after Prettier reformats the generated file.
- `check-fix` exits 0 again after regenerating.

## How to get to it (user POV)

- Run `tsdoc-defaults --check`, typically in CI.
- Run `tsdoc-defaults --check <files or globs...>` or with `-p <tsconfig>`, as in [generate](./generate.md).

## Driving it with verify.sh

Preconditions:

- Baseline from the [index](./README.md).

- **Generate.** Run `$V run 01-generate tsdoc-defaults`. Exit 0.
- **Fresh.** Run `$V run 02-check tsdoc-defaults --check`. Exit 0, no output.
- **Edit a tag.** Run `$V run 03-edit sed -i '' 's/`10_000`/`20_000`/' src/options.ts`.
- **Stale.** Run `$V run 04-check-stale tsdoc-defaults --check`. Exit 1; stderr is `src/options.defaults.ts is stale: run tsdoc-defaults`; the generated file in the record still holds `timeoutMs: 10_000`.
- **Fix.** Run `$V run 05-regenerate tsdoc-defaults`, then `$V run 06-check tsdoc-defaults --check`. Exit 0; the file holds `timeoutMs: 20_000`.
- **Format.** Run `$V run 07-prettier prettier --write src/options.defaults.ts`, then `$V run 08-check-formatted tsdoc-defaults --check`. Exit 0; the record shows the reformatted file (`import os from "node:os";`, double quotes and a semicolon).

## Gotchas

- The stale message goes to stderr, not stdout.
- Prettier is the repo's copy, but the repo's `.prettierrc` doesn't apply in the project, so it formats with Prettier's defaults.
