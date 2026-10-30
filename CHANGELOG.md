# Changelog

## [1.0.0](https://github.com/RasmusKard/tsdoc-defaults/compare/v0.1.1...v1.0.0) (2026-10-30)

The CLI, API and TypeDoc plugin are now stable: breaking changes bump the major version.
Upgrading from 0.1: if a `.defaults.ts` file you wrote by hand sits next to a source with default tags, rename it; generation now stops with an error instead of overwriting it.

### Features

* Export `isOutput`, which reports whether a path is named like a generated module ([c13abd1](https://github.com/RasmusKard/tsdoc-defaults/commit/c13abd10f4549ea5774e10e200017fd458e395df))

### Bug Fixes

* Make --check reliable and never touch hand-written .defaults.ts files ([c13abd1](https://github.com/RasmusKard/tsdoc-defaults/commit/c13abd10f4549ea5774e10e200017fd458e395df))
  * `--check` compares syntax trees: an edit inside a string is now stale, and Prettier's quote and parenthesis changes no longer are.
  * A `.defaults.ts` file without the generated header is never overwritten or removed; it is an error if its source has tags.
  * Two sources with code defaults and one output path (`a.ts` and `a.tsx`) are an error instead of one silently winning.
  * `GenerateResult.obsolete` lists only generated files that exist on disk, not every possible output path.

## [0.1.1](https://github.com/RasmusKard/tsdoc-defaults/compare/v0.1.0...v0.1.1) (2026-10-29)


### Bug Fixes

* Avoid polynomial backtracking in inline code span detection ([#13](https://github.com/RasmusKard/tsdoc-defaults/issues/13)) ([5574446](https://github.com/RasmusKard/tsdoc-defaults/commit/5574446cc9b68e95e39316afc12b077c0e02f127))

## 0.1.0 (2026-10-29)


### Features

* Add the CLI and API: generate and check typed defaults files from `@default` and `@defaultValue` tags ([4a817cb](https://github.com/RasmusKard/tsdoc-defaults/commit/4a817cb2374c516f2eb0b17b451625d2f424c1cd))
* Add the TypeDoc plugin: expression defaults render in the signature row ([5099cbc](https://github.com/RasmusKard/tsdoc-defaults/commit/5099cbcbcdf0ef57af8af445b2df0584a3f572ef))
