import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { extractDefaults, formatError, generate } from '../src/index.js';

const fx = path.resolve(fileURLToPath(import.meta.url), '../fixtures');

const compileErrors = (configPath: string) => {
  const file = ts.readConfigFile(configPath, (f) => ts.sys.readFile(f));
  const { fileNames, options } = ts.parseJsonConfigFileContent(
    file.config,
    ts.sys,
    path.dirname(configPath),
  );
  return ts
    .getPreEmitDiagnostics(ts.createProgram(fileNames, options))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
};

for (const name of ['basic.ts', 'imports.ts']) {
  void test(`generates ${name}`, () => {
    const r = generate([path.join(fx, name)]);
    assert.deepEqual(r.errors, []);
    const [file] = r.files;
    assert.equal(file.text, fs.readFileSync(file.output, 'utf8'));
  });
}

void test('generated modules compile', () => {
  assert.deepEqual(compileErrors(path.join(fx, 'tsconfig.json')), []);
});

void test('a default of the wrong type does not compile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsdoc-defaults-'));
  fs.copyFileSync(
    path.join(fx, 'tsconfig.json'),
    path.join(dir, 'tsconfig.json'),
  );
  const source = path.join(dir, 'wrong.ts');
  fs.writeFileSync(
    source,
    "export interface Opts {\n  /** @default `'ten'` */\n  timeoutMs?: number;\n}\n",
  );
  const [file] = generate([source]).files;
  fs.writeFileSync(file.output, file.text);
  assert.notDeepEqual(compileErrors(path.join(dir, 'tsconfig.json')), []);
});

const UNSUPPORTED =
  'unsupported location for a default tag: only direct members of top-level interfaces and object-type aliases';
const LOCAL = (id: string) =>
  `\`${id}\` cannot reference a local declaration from a default; export it from another module or make it ambient`;
const NOT_EXPORTED =
  'not exported; export it so the generated module can import its type';
const errors: Record<string, string[]> = {
  'directive.ts': [
    '1:1 malformed directive: a tsdoc-defaults comment must be one import statement',
    '2:3 malformed directive: a tsdoc-defaults comment must be one import statement',
  ],
  'duplicate.ts': [
    '4:6 Opts.both: has both @default and @defaultValue (or one twice); keep one',
    '12:7 Opts.0: has both @default and @defaultValue (or one twice); keep one',
  ],
  'generic.ts': ['1:1 Generic: generic declarations are not supported'],
  'local.ts': [
    `8:7 Opts.a: ${LOCAL('LOCAL')}`,
    `10:7 Opts.b: ${LOCAL('helper')}`,
    `12:7 Opts.mode: ${LOCAL('Mode')}`,
  ],
  'not-exported.ts': [
    `1:1 Hidden: ${NOT_EXPORTED}`,
    `6:1 Renamed: ${NOT_EXPORTED}`,
    `11:1 Default: ${NOT_EXPORTED}`,
  ],
  'not-expression.ts': [
    '2:7 Opts.span: the code in the default tag is not one expression',
    '5:6 Opts.fence: the code in the default tag is not one expression',
  ],
  'unsupported.ts': [
    `2:7 ${UNSUPPORTED}`,
    `5:9 ${UNSUPPORTED}`,
    `11:7 ${UNSUPPORTED}`,
    `17:6 ${UNSUPPORTED}`,
  ],
};

for (const [name, expected] of Object.entries(errors)) {
  void test(`reports the errors in ${name}`, () => {
    const file = path.join(fx, 'errors', name);
    const r = extractDefaults(fs.readFileSync(file, 'utf8'), name);
    assert.deepEqual(
      r.errors.map((e) => formatError(e).slice(name.length + 1)),
      expected,
    );
  });
}
