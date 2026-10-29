# tsdoc-defaults

**A CLI that turns TSDoc `@default` tags into a typed `DEFAULTS` constant, so the default your docs show is the one your code uses.**

<table>
<tr><th>Without tsdoc-defaults: the default lives twice</th><th>With tsdoc-defaults: the default lives once</th></tr>
<tr><td valign="top">

```ts
// types.ts
export interface Options {
  /** @default `10_000` */
  timeoutMs?: number;
}

// client.ts
const timeoutMs = opts.timeoutMs
  ?? 5_000; // drifted
```

</td><td valign="top">

```ts
// types.ts
export interface Options {
  /** @default `10_000` */
  timeoutMs?: number;
}

// client.ts
import { DEFAULTS } from './types.defaults';

const timeoutMs = opts.timeoutMs
  ?? DEFAULTS.Options.timeoutMs;
```

</td></tr>
</table>

`types.defaults.ts` is generated from the tags; commit it. Mistakes fail the build:

| Mistake | Caught by |
| --- | --- |
| `` @default `'10s'` `` on a `number` | `tsc`: Type 'string' is not assignable to type 'number'. |
| Tag removed, code still reads it | `tsc`: Property 'timeoutMs' does not exist on type … |
| Tag edited, file not regenerated | `--check`: src/types.defaults.ts is stale: run tsdoc-defaults |

The [TypeDoc plugin](#typedoc) also puts the default in the signature.

**[Demo: a source, its generated file and the rendered docs](https://rasmuskard.github.io/tsdoc-defaults/)**

## Install

```sh
npm install --save-dev tsdoc-defaults
```

_ESM only, Node 22 or later. Uses its own `typescript` dependency; your project's version does not matter._

## Usage

1. Tag a member with `@default` ([which tags count](#tags)).
2. Generate `<name>.defaults.ts` next to each source with tags, and commit it:

   ```sh
   tsdoc-defaults
   ```

3. Read the default where it applies:

   ```ts
   const timeoutMs = opts.timeoutMs ?? DEFAULTS.Options.timeoutMs;
   ```

   Each default has its member's declared type: `number`, not `10_000`.
   Don't re-export `DEFAULTS` from your package.

4. In CI, fail when a tag was edited but its file wasn't regenerated:

   ```sh
   tsdoc-defaults --check
   ```

## CLI

```sh
tsdoc-defaults [files or globs...] [--check] [--project <tsconfig>]
```

| Argument | What it does |
| --- | --- |
| `files or globs` | The sources to read. Default: the TypeScript files the tsconfig includes. Quote globs. |
| `--check` | Writes nothing; exits 1 and names each stale generated file. Formatting and comments don't count, so Prettier may run on generated files. |
| `-p`, `--project <tsconfig>` | The tsconfig to use. Default: `./tsconfig.json`. It sets the default sources and the extension of the generated file's import. |

- **Output:** `<name>.defaults.ts` next to each source with tags (`.defaults.mts`/`.defaults.cts` for `.mts`/`.cts`). Leftovers are removed.
- **Exit codes:**
  - `0`: done
  - `1`: tag errors, printed as `file:line:col` with nothing written; or stale files with `--check`
  - `2`: usage error

## API

`extractDefaults`, `generate` and `check` do the same from code; see their TSDoc.

## Tags

`@default` or `@defaultValue`, on a direct member of an exported, non-generic, top-level interface or object type alias.

A code span is content in backticks; bare text is anything else.

| Tag | Generated | Note |
| --- | --- | --- |
| `@default 10_000` or `` @default `10_000` `` | `10_000` | backticks are optional |
| `` @default `os.tmpdir()` `` | `os.tmpdir()` | the file's `os` import is copied |
| `// tsdoc-defaults: import os from 'node:os'`<br>`` @default `os.tmpdir()` `` | `os.tmpdir()` | if only the tag uses `os`, add this comment anywhere in the file |
| `` @default `process.env.PORT` `` | `process.env.PORT` | |
| `@default process.env.PORT` | nothing | skipped: bare text may use only `NaN`, `Infinity` and `globalThis` as globals; use a code span |
| `@default the temp directory` | nothing | skipped: prose |
| `@default undefined` | nothing | skipped: no default |
| `` @default `{ a:` `` | nothing | **error**: a code span must be one expression |

## TypeDoc

```json
{ "plugin": ["tsdoc-defaults/typedoc"] }
```

Requires `typedoc@^0.28` (optional peer dependency).

- A default that is one expression renders in the signature: `timeoutMs?: number = 10_000`.
- Prose stays a "Default" block.
- So does bare text that reads an imported name (`@default DEFAULT_TIMEOUT`). Write it as a code span to get it in the signature.

**[Demo](https://rasmuskard.github.io/tsdoc-defaults/)**

## Limits

- Nothing stops code from bypassing `DEFAULTS` with its own literal.
- A tag that isn't one expression is prose and gets no entry, so `@default 10s` on a `number` is skipped without an error.

## FAQ

**Why not keep defaults in a `const` and `{@link}` it from the tag?** Hovers and generated docs then show the constant's name instead of its value.

## License

MIT
