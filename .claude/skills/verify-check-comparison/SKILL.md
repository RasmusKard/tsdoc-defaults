---
name: verify-check-comparison
description: Check a tsdoc-defaults change against the two promises of `--check`'s comparison (`sameSyntax` in src/compare.ts) with fast-check over generated default expressions. It never calls a stale generated file fresh, and it ignores what Prettier changes. Use when a change touches src/compare.ts, the generated module's text (src/render.ts), how a default's expression is cut out (`parseDefault` in src/expressions.ts), or bumps `typescript` or `prettier`.
---

# Verify the `--check` comparison

`tsdoc-defaults --check` (and the `check` API) regenerates each `<name>.defaults.ts` in memory and compares it with the file on disk using `sameSyntax` (src/compare.ts), which compares syntax trees and ignores formatting. Tests check the pairs someone thought of. This check generates thousands of default expressions, prints each in many equivalent spellings and edits some of them, then checks two properties on the real `parseDefault` → `renderModule` → `sameSyntax` path:

| Property (test name) | Harm if broken |
| --- | --- |
| **Fresh means same value**: `--check never calls a file fresh when its DEFAULTS would differ`. If `sameSyntax(onDisk, regenerated)` is true, both modules load to the same `DEFAULTS` (compared with `util.inspect`, so key order, prototypes, `-0`, holes and thrown errors count). | CI passes while the committed file holds an old default, so the code silently runs with a value the docs no longer state. |
| **Prettier doesn't count**: `--check ignores what Prettier changes in a generated file`. A generated module and Prettier's output for it (random `singleQuote`, `quoteProps`, `trailingComma`, `semi`, `bracketSpacing`, `objectWrap`, `arrowParens`, `printWidth`) compare the same. | The README says Prettier may run on generated files; if it can't, `--check` fails CI on every run with no tag edited. |

The harness is [test/same-syntax.property.ts](../../../test/same-syntax.property.ts). `pnpm test` does not run it.

## Does the change touch the verified code?

Run the check if the diff touches any file in the coverage record below, or `typescript`/`prettier` in pnpm-lock.yaml. List what changed since the record was last confirmed:

```sh
git diff --stat 3b75eb8..HEAD -- src/compare.ts src/render.ts src/expressions.ts src/index.ts pnpm-lock.yaml
```

## Run

```sh
pnpm run verify
```

It runs 10,000 cases for the first property and a sixth as many for the second. Each run draws new random cases. For a deeper sweep before a release or after changing src/compare.ts, set `VERIFY_RUNS`:

```sh
VERIFY_RUNS=50000 pnpm run verify
```

## Read the result

- **Pass**: both property tests show `✔`.
- **`Property failed`**: the output holds `Counterexample` (the generated tree, as JSON), the `seed` and `path`, and in `[cause]` the two module texts. The first property prints `--- on disk` and `--- regenerated` with both `DEFAULTS` printouts as `+ actual`/`- expected`. The second prints `generated:` and `--- after prettier {options}:`. fast-check has already shrunk the case, so read the module texts, not the JSON.
- **`only N runs compared differently spelled modules as the same`**: the generator, not the product. Too few cases reached the "same" branch for the first property to mean anything. Look at what the last change to the harness or to `renderModule` did to the printed texts.

### Real bug or modeling error?

It is a **real bug** when both texts are valid JavaScript that tsdoc-defaults could have written, `sameSyntax` calls them the same, and they load to different `DEFAULTS`, or when Prettier kept the meaning and `sameSyntax` calls the texts different. To confirm one, add the two texts as a pair in test/compare.test.ts (`code changes count` or `formatting does not count`) and run `pnpm test`. That gives a reproducer that runs on every change without the generator.

It is a **modeling error** when the counterexample depends on something the harness should have filtered out. The harness already skips these cases:

- Texts that are not valid JavaScript (`0 ?? 1 || 2`, `++0`, `-1 as number ** 2`). The TypeScript parser accepts them and leaves them to the type checker. `evaluate` returns undefined for them.
- Inputs that Prettier rejects (`{ a: 0, f() }`) or that it breaks (it moves a `// c` into a string ending a line with `\`, or writes `(<number>0) ** 0` as the syntax error `<number>0 ** 0`).
- Values that are not deterministic. `new Date()` was dropped from the grammar for that reason.

A new failure of that kind means a filter or the grammar needs fixing in the harness, with a one-line comment saying why. Never weaken a property to make a real counterexample pass. Report it as a finding instead, and pin it the way the open finding below is pinned.

## Scope and bounds

Verified: `sameSyntax` on modules that `renderModule` produces from one or two members of one declaration (`Options`). Each default is an expression tree up to depth 3, built from:

- numbers, bigints, strings, `String.raw` templates, templates with substitutions, regexes and keyword values
- unary and binary operators, conditionals and comma lists
- arrays (holes, spreads) and objects (quoted, numeric and computed keys, `__proto__`, spreads)
- property and element access, with and without `?.`
- calls to a few pure globals (`Math.max`, `String`, ...), `new Map`/`Set`/`String`/`Number`/`Array`
- casts (`as`, `satisfies`, `!`, `<number>`)

Every spelling the printer knows is exercised: number bases, separators and exponents, quotes and escapes, line continuations, CRLF in templates, key forms, parentheses, whitespace, comments and regex flag order.

The check is random sampling over that grammar, not a proof: a pass means no counterexample in the cases drawn. Not covered:

- Functions, classes and arrow functions, whose values can't be compared by loading them, and free identifiers other than the globals above, imports and `// tsdoc-defaults:` directive lines.
- Type-only differences (`as number` vs `as string`). Loading the module erases types, so the first property can't see them.
- Everything around the comparison in `check`: missing, obsolete or header-less files (src/index.ts), how tags become expressions (src/tags.ts, `extractDefaults`), and the CLI. For those, see [verify-cli](../verify-cli/SKILL.md) and `pnpm test`.
- Prettier options not listed above, and Prettier versions other than the one in pnpm-lock.yaml.

## Keep it in step with the code

When a change to the covered code is intended (a new form the comparison ignores, a new kind of generated content), update the harness in the same change. Add the new syntax to the grammar (`expr` in the `fc.letrec`) and its spellings to `Printer`, then show that the check can still fail. Break the code the change added, for example by removing the new case, run `pnpm run verify`, see `✖`, and revert. These breaks of src/compare.ts are known to be caught. Use them to confirm the harness still has teeth after editing it:

| Break | Caught by |
| --- | --- |
| Remove `'operator'` from `SCALARS` (`+0` vs `-0` compare equal) | Fresh means same value |
| Drop `ts.NodeFlags.OptionalChain` from `FLAGS` (`(null?.a).b` vs `null?.a.b`) | Fresh means same value |
| Push `x` instead of `unwrap(x)` in `children` (parentheses count) | Prettier doesn't count |
| Return `n.rawText` without the CRLF replacement in `textOf` | Prettier doesn't count |
| Return `n.text` for regexes in `textOf` (flag order counts) | Prettier doesn't count |

### Coverage record

| Check | Covers |
| --- | --- |
| Both properties | src/compare.ts: `sameSyntax`, `sameChildren`, `sameNode`, `children`, `textOf`, `keyText`, `unwrap`, `SCALARS`, `FLAGS` |
| Both properties (input path) | src/render.ts: `renderModule`, `renderMember`; src/expressions.ts: `parseDefault`, `parseExpression`, `parseDiagnostics` |
| Fresh means same value (caller) | src/index.ts: `isStale`, `check` (the call `sameSyntax(disk, regenerated)`) |

**Sync commit: `3b75eb8`.** The verification was last confirmed to describe the covered code at that commit. Move it forward only after you have read the covered functions at the new commit, confirmed the grammar and properties still match them, run `pnpm run verify`, and seen a break from the table above fail.
