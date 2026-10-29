import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractDefaults, outputPath } from '../src/index.js';

const extract = (lines: string[], eol = '\n') => {
  const r = extractDefaults(lines.join(eol), 'opts.ts');
  assert.deepEqual(r.errors, []);
  return r;
};

void test('a CRLF source yields an LF-only expression', () => {
  const r = extract(
    [
      'export interface Opts {',
      '  /**',
      '   * @default',
      '   * ```ts',
      '   * {',
      '   *   a: 1,',
      '   * }',
      '   * ```',
      '   */',
      '  x?: number;',
      '}',
    ],
    '\r\n',
  );
  assert.deepEqual(
    r.members.map((m) => m.expression),
    ['{\n  a: 1,\n}'],
  );
});

void test('bare text that only balances the added parentheses is prose', () => {
  const r = extract([
    'export interface Opts {',
    '  /** @default 1) + (2 */',
    '  x?: number;',
    '}',
  ]);
  assert.deepEqual(r.members, []);
});

void test('a directive is a real line comment, not a mention in a string or block comment', () => {
  const r = extract([
    "const a = 1; // tsdoc-defaults: import { P } from 'p'",
    'const s = \'// tsdoc-defaults: import { S } from "s"\';',
    '/** Needs a `// tsdoc-defaults: import { T } from "t"` line. */',
    'export interface Opts {',
    '  /** @default `P.x` */',
    '  p?: number;',
    '}',
  ]);
  assert.deepEqual(r.directives, ["import { P } from 'p'"]);
});

void test('import attributes, `import x = require()` and type-only imports are copied as written', () => {
  const r = extract([
    "import data from './d.json' with { type: 'json' };",
    "import cfg = require('./cfg');",
    "import type { OnlyType } from './only';",
    'export interface Opts {',
    '  /** @default `data.x` */ a?: number;',
    '  /** @default `cfg.y` */ b?: number;',
    '  /** @default `OnlyType.z` */ c?: number;',
    '}',
  ]);
  assert.deepEqual(r.imports, [
    "import data from './d.json' with { type: 'json' };",
    "import cfg = require('./cfg');",
    "import type { OnlyType } from './only';",
  ]);
});

void test('outputPath', () => {
  assert.equal(outputPath('a/x.ts'), 'a/x.defaults.ts');
  assert.equal(outputPath('x.mts'), 'x.defaults.mts');
  assert.equal(outputPath('x.d.ts'), 'x.defaults.ts');
  assert.equal(outputPath('x.js'), 'x.js.defaults.ts');
});
