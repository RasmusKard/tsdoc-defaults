import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractDefaults, formatError } from '../../src/index.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
const UNSUPPORTED =
  'unsupported location for a default tag: only direct members of top-level interfaces and object-type aliases';
const LOCAL = (id: string) =>
  `\`${id}\` cannot reference a local declaration from a default; export it from another module or make it ambient`;

// One fixture per error class; each asserts the exact error set, so a prose tag never counts as an error.
const cases: Record<string, string[]> = {
  'duplicate.ts': [
    '4:6 Opts.both: has both @default and @defaultValue (or one twice); keep one',
  ],
  'generic.ts': ['1:1 Generic: generic declarations are not supported'],
  'not-exported.ts': [
    '1:1 Hidden: not exported; export it so the generated module can import its type',
    '6:1 Renamed: not exported; export it so the generated module can import its type',
    '11:1 Default: not exported; export it so the generated module can import its type',
  ],
  'local.ts': [
    `7:7 Opts.a: ${LOCAL('LOCAL')}`,
    `9:7 Opts.b: ${LOCAL('helper')}`,
  ],
  'unsupported.ts': [
    `3:9 ${UNSUPPORTED}`,
    `9:7 ${UNSUPPORTED}`,
    `15:6 ${UNSUPPORTED}`,
  ],
  'not-expression.ts': [
    '2:7 Opts.span: the code in the default tag is not one expression',
    '5:6 Opts.fence: the code in the default tag is not one expression',
  ],
  'directive.ts': [
    '1:1 malformed directive: a tsdoc-defaults comment must be one import statement',
    '2:3 malformed directive: a tsdoc-defaults comment must be one import statement',
  ],
};

for (const [name, expected] of Object.entries(cases)) {
  void test(`error fixture ${name}`, () => {
    const file = path.join(root, 'test/fixtures/errors', name);
    const r = extractDefaults(fs.readFileSync(file, 'utf8'), name);
    assert.deepEqual(
      r.errors.map((e) => formatError(e).slice(name.length + 1)),
      expected,
    );
  });
}
