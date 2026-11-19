# Generate defaults

Running `tsdoc-defaults` writes `<name>.defaults.ts` next to each source with code defaults. The file exports `DEFAULTS`, typed with each member's declared type, which the consumer's code imports, compiles and reads at runtime.

## Sub-features

- `gen-tsconfig` generates for the files the tsconfig includes when no files are passed.
- `gen-files` generates for files or quoted globs passed as arguments.
- `gen-project` reads the tsconfig named by `-p`/`--project`.
- `gen-typed` makes the generated module compile, with the declared types, under the consumer's `tsc`.
- `gen-runtime` makes `DEFAULTS` hold the tag values at runtime, including copied imports.
- `gen-prose` skips prose defaults.
- `gen-obsolete` removes a generated file whose source lost its code defaults.

## How to get to it (user POV)

- Run `tsdoc-defaults` in a project with a `tsconfig.json`.
- Run `tsdoc-defaults <files or globs...>`.
- Run `tsdoc-defaults -p <tsconfig>`.

## Driving it with verify.sh

Preconditions:

- Baseline from the [index](./README.md).

- **Before.** Compile without the generated file. Run `$V run 01-tsc-before tsc -p .`. Exit 2 with `Cannot find module './options.defaults.js'`.
- **tsconfig entry.** Run `$V run 02-generate tsdoc-defaults`. Exit 0, no output; the file list gains `./src/options.defaults.ts`, which imports `./options.js`, copies `import os from 'node:os'` and holds `timeoutMs: 10_000`, `retries: 3`, `cacheDir: os.tmpdir()` and no `baseUrl` (`gen-prose`).
- **Typed.** Run `$V run 03-tsc-after tsc -p .`. Exit 0.
- **Runtime.** Run `$V run 04-runtime node -e "import('./src/options.defaults.ts').then(m => console.log(JSON.stringify(m.DEFAULTS)))"`. Exit 0; stdout is `{"ClientOptions":{"timeoutMs":10000,"retries":3,"cacheDir":"<the OS temp dir>"}}`.
- **Files entry.** Remove the output and pass the source. Run `$V run 05-rm rm src/options.defaults.ts`, then `$V run 06-generate-file tsdoc-defaults src/options.ts`. Exit 0; `./src/options.defaults.ts` is back with the same content.
- **Glob entry.** Run `$V run 07-rm rm src/options.defaults.ts`, then `$V run 08-generate-glob tsdoc-defaults 'src/*.ts'`. Exit 0; same file back, and no `client.defaults.ts` (no tags there).
- **Project entry.** Run `$V run 09-mv mv tsconfig.json app.tsconfig.json`, then `$V run 10-no-config tsdoc-defaults`. Exit 2 with the usage line. Run `$V run 11-project tsdoc-defaults -p app.tsconfig.json`. Exit 0. Restore with `$V run 12-mv mv app.tsconfig.json tsconfig.json`.
- **Obsolete.** Make every tag prose. Run `$V run 13-prose sed -i '' -e 's/`10_000`/ten seconds/' -e 's/@defaultValue 3/@defaultValue three/' -e 's/`os.tmpdir()`/the temp dir/' src/options.ts`, then `$V run 14-obsolete tsdoc-defaults`. Exit 0; `./src/options.defaults.ts` is gone from the file list.

## Gotchas

- `run` doesn't fail when the command does. Read `exit:` in every record.
- The import extension follows the tsconfig: `.js` here because of `module: nodenext`. A tsconfig without node16/nodenext resolution generates extensionless imports, and `allowImportingTsExtensions` generates `.ts`.
- `node` runs the `.ts` file through Node's type stripping (Node 22.18 or later, or 23.6 or later). On an older Node, the runtime step fails with an unknown-extension error; report it as unreachable, not as a bug.
- Without quotes, the shell expands a glob before the CLI sees it. That still works but tests a different entry point.
