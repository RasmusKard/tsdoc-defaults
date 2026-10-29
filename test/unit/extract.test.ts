import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractDefaults, outputPath } from '../../src/index.js';

const member = (tag: string, head = '') =>
  `${head}\nexport interface Opts {\n  /** @default ${tag} */\n  x?: string;\n}\n`;

const expressions = (source: string) => {
  const r = extractDefaults(source, 'opts.ts');
  assert.deepEqual(r.errors, []);
  return r.members.map((m) => m.expression);
};

void test('bare text is code when it parses, prose when it does not', () => {
  assert.deepEqual(expressions(member('14')), ['14']);
  assert.deepEqual(expressions(member("'cover'")), ["'cover'"]);
  assert.deepEqual(expressions(member('true')), ['true']);
  assert.deepEqual(expressions(member('{ a: 1 }')), ['{ a: 1 }']);
  assert.deepEqual(expressions(member('the platform accent color')), []);
  assert.deepEqual(expressions(member('`a` or `b`')), []);
  // Reads a name the file does not know: prose, like a lone unknown identifier.
  assert.deepEqual(expressions(member('100 (ms)')), []);
  assert.deepEqual(expressions(member('false (Android)')), []);
  // Any global beyond the language's own needs a code span.
  assert.deepEqual(expressions(member('process.env.X ?? 1')), []);
  assert.deepEqual(expressions(member('`process.env.X ?? 1`')), [
    'process.env.X ?? 1',
  ]);
  // Balances the parentheses the parser adds, but is not one expression.
  assert.deepEqual(expressions(member('1) + (2')), []);
  assert.deepEqual(
    extractDefaults(member('`1) || (2`'), 'opts.ts').errors.map(
      (e) => e.message,
    ),
    ['Opts.x: the code in the default tag is not one expression'],
  );
});

void test('the expression excludes surrounding comments and whitespace', () => {
  assert.deepEqual(expressions(member('`10_000 // ten seconds`')), ['10_000']);
  assert.deepEqual(
    expressions(
      member('\n * ```\n * // note\n * { a: 1 } // trailing\n * ```'),
    ),
    ['{ a: 1 }'],
  );
  assert.deepEqual(expressions(member('`` `${a}` ``')), ['`${a}`']);
});

void test('a CRLF source yields an LF-only expression', () => {
  const fence =
    'export interface Opts {\n  /**\n   * @default\n   * ```ts\n   * {\n   *   a: 1,\n   * }\n   * ```\n   */\n  x?: number;\n}\n';
  assert.deepEqual(expressions(fence.replace(/\n/g, '\r\n')), [
    '{\n  a: 1,\n}',
  ]);
});

void test('a bare lone identifier is prose unless the file knows it', () => {
  assert.deepEqual(expressions(member('none')), []);
  assert.deepEqual(expressions(member('auto')), []);
  assert.deepEqual(expressions(member('__DEV__')), []);
  // `undefined` is code, but means no default, so it generates nothing.
  assert.deepEqual(expressions(member('undefined')), []);
  assert.deepEqual(expressions(member('`undefined`')), []);
  assert.deepEqual(expressions(member('Infinity')), ['Infinity']);
  assert.deepEqual(expressions(member('Foo', "import { Foo } from './foo';")), [
    'Foo',
  ]);
  assert.deepEqual(
    expressions(
      member(
        'Platform',
        "// tsdoc-defaults: import { Platform } from 'react-native'",
      ),
    ),
    ['Platform'],
  );
  // A local declaration is not "known": the tag is prose, not a local-reference error.
  assert.deepEqual(expressions(member('LOCAL', 'const LOCAL = 1;')), []);
  // A code span is always code.
  assert.deepEqual(expressions(member('`inherit`')), ['inherit']);
});

void test('export lists make a declaration exported', () => {
  const r = extractDefaults(
    `interface Opts {\n  /** @default \`1\` */\n  x?: number;\n}\nexport type { Opts };\n`,
    'opts.ts',
  );
  assert.deepEqual(r.errors, []);
});

void test('imports and directives are copied once, in order of first use', () => {
  const r = extractDefaults(
    [
      "import { A, B } from './ab';",
      "import type { C } from './c';",
      "// tsdoc-defaults: import { P } from 'p'",
      "// tsdoc-defaults: import { P } from 'p'",
      'export interface Opts {',
      '  /** @default `B.one` */',
      '  b?: number;',
      '  /** @default `[A, B, P]` */',
      '  all?: unknown[];',
      '  /** @default `{ c: 1 }` */',
      '  c?: C;',
      '}',
    ].join('\n'),
    'opts.ts',
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.imports, [
    "import { B } from './ab';",
    "import { A } from './ab';",
  ]);
  assert.deepEqual(r.directives, ["import { P } from 'p'"]);
});

void test('a directive is any real line comment; a mention in a string or block comment is not one', () => {
  const r = extractDefaults(
    [
      "const a = 1; // tsdoc-defaults: import { P } from 'p'",
      "// tsdoc-defaults: import { P } from 'p';",
      'const s = \'// tsdoc-defaults: import { S } from "s"\';',
      '/** Needs a `// tsdoc-defaults: import { T } from "t"` line. */',
      'export interface Opts {',
      '  /** @default `P.x` */',
      '  p?: number;',
      '}',
    ].join('\n'),
    'opts.ts',
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.directives, ["import { P } from 'p'"]);
});

void test('import attributes and `import x = require()` are copied; a type-only import stays type-only', () => {
  const r = extractDefaults(
    [
      "import data from './d.json' with { type: 'json' };",
      "import cfg = require('./cfg');",
      "import type { OnlyType } from './only';",
      'export interface Opts {',
      '  /** @default `data.x` */ a?: number;',
      '  /** @default `cfg.y` */ b?: number;',
      '  /** @default `OnlyType.z` */ c?: number;',
      '}',
    ].join('\n'),
    'opts.ts',
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.imports, [
    "import data from './d.json' with { type: 'json' };",
    "import cfg = require('./cfg');",
    "import type { OnlyType } from './only';",
  ]);
});

void test('the right side of a qualified type name is not a reference; a same-file type is a local', () => {
  const r = extractDefaults(
    [
      "import * as NS from './ns';",
      'const Bar = 1;',
      "export type Mode = 'a' | 'b';",
      'export interface Opts {',
      '  /** @default `(x: NS.Bar) => x` */ e?: (x: unknown) => unknown;',
      "  /** @default `'a' as Mode` */ mode?: Mode;",
      '}',
    ].join('\n'),
    'opts.ts',
  );
  assert.deepEqual(
    r.errors.map((e) => e.message),
    [
      'Opts.mode: `Mode` cannot reference a local declaration from a default; export it from another module or make it ambient',
    ],
  );
});

void test('a computed name is unsupported; a member repeated across merged declarations is a duplicate', () => {
  const r = extractDefaults(
    [
      'export interface Opts {',
      '  /** @default `1` */ [Symbol.iterator]?: number;',
      '  /** @default `2` */ 0?: number;',
      '}',
      'export interface Opts {',
      '  /** @default `5` */',
      '  0?: number;',
      '}',
    ].join('\n'),
    'opts.ts',
  );
  assert.deepEqual(
    r.errors.map((e) => `${e.line}:${e.column} ${e.message}`),
    [
      '2:7 unsupported location for a default tag: only direct members of top-level interfaces and object-type aliases',
      '6:7 Opts.0: has both @default and @defaultValue (or one twice); keep one',
    ],
  );
});

void test('outputPath keeps the module flavour, drops .d and never returns the source', () => {
  assert.equal(outputPath('a/x.ts'), 'a/x.defaults.ts');
  assert.equal(outputPath('x.tsx'), 'x.defaults.ts');
  assert.equal(outputPath('x.mts'), 'x.defaults.mts');
  assert.equal(outputPath('x.cts'), 'x.defaults.cts');
  assert.equal(outputPath('x.d.ts'), 'x.defaults.ts');
  assert.equal(outputPath('x.d.mts'), 'x.defaults.mts');
  assert.equal(outputPath('x.js'), 'x.js.defaults.ts');
});
