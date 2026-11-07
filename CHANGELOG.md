# Changelog

## [1.0.2](https://github.com/RasmusKard/tsdoc-defaults/compare/v1.0.1...v1.0.2) (2026-11-07)


### Bug Fixes

* Accept indented and longer fences in a default tag ([#33](https://github.com/RasmusKard/tsdoc-defaults/issues/33)) ([df9a1ce](https://github.com/RasmusKard/tsdoc-defaults/commit/df9a1ce6d87c2ec79a12da1560300aaf73f927e3))
* Find a directive that follows a template literal with a substitution ([#27](https://github.com/RasmusKard/tsdoc-defaults/issues/27)) ([8166a43](https://github.com/RasmusKard/tsdoc-defaults/commit/8166a43b7302b613fa7f90844878e4777d624625))
* Ignore the order of regex flags in --check ([#39](https://github.com/RasmusKard/tsdoc-defaults/issues/39)) ([d57fa2c](https://github.com/RasmusKard/tsdoc-defaults/commit/d57fa2ce75c9478afc4d4f61a4b88af759de8b17))
* Import .mts and .cts sources with their module-flavoured extension ([#37](https://github.com/RasmusKard/tsdoc-defaults/issues/37)) ([cf59fe4](https://github.com/RasmusKard/tsdoc-defaults/commit/cf59fe416caec06a8f26654574e5deece852f366))
* Import a name a directive binds only through the directive ([#28](https://github.com/RasmusKard/tsdoc-defaults/issues/28)) ([e537928](https://github.com/RasmusKard/tsdoc-defaults/commit/e5379287144d295fd8467c971cf2d94945a3f379))
* Keep a generated file that another source still generates ([#38](https://github.com/RasmusKard/tsdoc-defaults/issues/38)) ([e65db4a](https://github.com/RasmusKard/tsdoc-defaults/commit/e65db4a00498e59ff2a11c96a7a540f9d0f8c007))
* Keep the value of a string continued over several lines with a backslash ([#35](https://github.com/RasmusKard/tsdoc-defaults/issues/35)) ([54f915a](https://github.com/RasmusKard/tsdoc-defaults/commit/54f915ad665becb6614d42d36b856859151d97a3))
* Leave out directives that no default reads ([#29](https://github.com/RasmusKard/tsdoc-defaults/issues/29)) ([b3a6379](https://github.com/RasmusKard/tsdoc-defaults/commit/b3a6379145e51559bb93037bd7e189d6358d4ef9))
* Read a CLI argument that names a file as is and skip directories ([#36](https://github.com/RasmusKard/tsdoc-defaults/issues/36)) ([da9a478](https://github.com/RasmusKard/tsdoc-defaults/commit/da9a4781423afea5c65c15e29d7cedb1400458fb))
* Report a changed raw template or typeof import as stale in --check ([#40](https://github.com/RasmusKard/tsdoc-defaults/issues/40)) ([61eb661](https://github.com/RasmusKard/tsdoc-defaults/commit/61eb66160eb69b1163d12b406cee91bb310e8259))
* Report a code span or fence in a default tag that is not closed ([#34](https://github.com/RasmusKard/tsdoc-defaults/issues/34)) ([f226a14](https://github.com/RasmusKard/tsdoc-defaults/commit/f226a143b99054fe0f11b7c36fca95624b0f68fa))
* Report a default that reads a local namespace or destructured variable ([#30](https://github.com/RasmusKard/tsdoc-defaults/issues/30)) ([f46d993](https://github.com/RasmusKard/tsdoc-defaults/commit/f46d993dbc7dc931934dcbf14fddcc5f4f8c67c2))
* Report a default that reads DEFAULTS and a declaration named DEFAULTS ([#31](https://github.com/RasmusKard/tsdoc-defaults/issues/31)) ([c14510d](https://github.com/RasmusKard/tsdoc-defaults/commit/c14510dd06d97c430b185dd7bf80d0557ff5c137))
* Stop --check from mistaking one optional part of the code for another ([#41](https://github.com/RasmusKard/tsdoc-defaults/issues/41)) ([0226218](https://github.com/RasmusKard/tsdoc-defaults/commit/0226218db37f152e43ee498445e8a45f6dc6e5d9))
* Treat a comma-separated list in a default tag as not one expression ([#32](https://github.com/RasmusKard/tsdoc-defaults/issues/32)) ([40ba1a2](https://github.com/RasmusKard/tsdoc-defaults/commit/40ba1a24b3ca9d305dd3199862a5159d790de012))

## [1.0.1](https://github.com/RasmusKard/tsdoc-defaults/compare/v1.0.0...v1.0.1) (2026-10-30)


### Bug Fixes

* Remove generated files whose source was deleted ([#21](https://github.com/RasmusKard/tsdoc-defaults/issues/21)) ([8a14884](https://github.com/RasmusKard/tsdoc-defaults/commit/8a1488450ccde080942abca4486b7d52f4ec200e))

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
