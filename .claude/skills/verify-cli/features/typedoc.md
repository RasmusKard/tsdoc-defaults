# TypeDoc plugin

With `tsdoc-defaults/typedoc` as a TypeDoc plugin, a default that is one expression renders in the property signature (`timeoutMs?: number = 10_000`) and leaves the comment; a prose default stays a "Default" block.

## Sub-features

- `td-signature` renders code defaults, from a code span or bare text, in the signature.
- `td-prose` keeps prose defaults as a Default block.

## How to get to it (user POV)

- `{ "plugin": ["tsdoc-defaults/typedoc"] }` in `typedoc.json`, or `typedoc --plugin tsdoc-defaults/typedoc`.

## Driving it with verify.sh

Preconditions:

- Baseline from the [index](./README.md).

- **Generate.** Run `$V run 01-generate tsdoc-defaults`. Exit 0.
- **Render.** Run `$V run 02-docs typedoc --name verify --plugin "$PWD/dist/typedoc.js" --out docs --readme none --treatWarningsAsErrors src/options.ts`. Exit 0; stdout has `Loaded plugin …/dist/typedoc.js`.
- **Signatures.** Run `$V run 03-html sh -c "sed 's/<[^>]*>//g' docs/interfaces/ClientOptions.html | grep -E '\?: (number|string) ='"`. Exit 0; stdout has `timeoutMs?: number = 10_000`, `retries?: number = 3` and `cacheDir?: string = os.tmpdir()`.
- **Prose.** Run `$V run 04-prose sh -c "sed 's/<[^>]*>//g' docs/interfaces/ClientOptions.html | grep 'Default'"`. Exit 0; stdout has `Defaultthe origin of the current page`, and no `baseUrl?: string =` line.

## Gotchas

- TypeDoc type-checks the whole project, and `src/client.ts` imports the generated file, so rendering before generating exits 3 with `TS2307: Cannot find module './options.defaults.js'`.
- Without `--name` TypeDoc warns about the missing name, and `--treatWarningsAsErrors` turns that into exit 3.
- The plugin path is the built `dist/typedoc.js` by absolute path, since the project doesn't install the package. `$PWD` is the repo root because `$V` runs from there.
- The rendered HTML is in the project's `docs/`, which `run` leaves out of its file list; grep it with a `run` so the match is in the record.
