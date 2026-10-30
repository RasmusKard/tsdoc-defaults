import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const cliIn = (cwd: string, ...args: string[]) => {
  const r = spawnSync(
    path.join(root, 'node_modules/.bin/tsx'),
    [path.join(root, 'src/cli.ts'), ...args],
    { cwd, encoding: 'utf8' },
  );
  return { code: r.status, out: r.stdout + r.stderr };
};
const cli = (...args: string[]) => cliIn(root, ...args);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tsdoc-defaults-'));
const SOURCE =
  'export interface Opts {\n  /** @default `1` */\n  x?: number;\n}\n';

void test('globs match sources but never generated files', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.ts'), SOURCE);
  assert.equal(cli(path.join(dir, '*.ts')).code, 0);
  assert.equal(cli(path.join(dir, '*.ts')).code, 0);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['a.defaults.ts', 'a.ts']);
});

void test('usage', () => {
  const help = cli('--help');
  assert.equal(help.code, 0);
  assert.match(help.out, /^usage: /);
  assert.equal(cli('--bogus', 'x.ts').code, 2);
  assert.equal(cli(path.join(tmp(), '*.ts')).code, 2);
  assert.equal(cliIn(tmp()).code, 2);
});

void test('errors exit 1 as file:line:col and write nothing', () => {
  const r = cli('test/fixtures/errors/generic.ts');
  assert.equal(r.code, 1);
  assert.match(
    r.out,
    /generic\.ts:1:1 Generic: generic declarations are not supported/,
  );
  assert.equal(
    fs.existsSync(path.join(root, 'test/fixtures/errors/generic.defaults.ts')),
    false,
  );
});

void test('--check ignores formatting and fails on stale, missing or leftover files', () => {
  const dir = tmp();
  const source = path.join(dir, 'a.ts');
  const output = path.join(dir, 'a.defaults.ts');
  fs.writeFileSync(source, SOURCE);
  assert.equal(cli(source).code, 0);
  assert.equal(cli('--check', source).code, 0);
  const text = fs.readFileSync(output, 'utf8');
  fs.writeFileSync(
    output,
    text.replace('x: 1,', 'x:   1').replace('//', '// edited'),
  );
  assert.equal(cli('--check', source).code, 0);
  fs.writeFileSync(output, text.replace('x: 1', 'x: 2'));
  const stale = cli('--check', source);
  assert.equal(stale.code, 1);
  assert.match(stale.out, /a\.defaults\.ts is stale: run tsdoc-defaults/);
  fs.rmSync(output);
  assert.equal(cli('--check', source).code, 1);
  assert.equal(cli(source).code, 0);
  fs.writeFileSync(source, 'export interface Opts {\n  x?: number;\n}\n');
  assert.equal(cli('--check', source).code, 1);
  assert.equal(cli(source).code, 0);
  assert.deepEqual(fs.readdirSync(dir), ['a.ts']);
});

void test('a generated file whose source was deleted is stale, then removed', () => {
  const dir = tmp();
  const glob = path.join(dir, '*.ts');
  fs.writeFileSync(path.join(dir, 'a.ts'), SOURCE);
  fs.writeFileSync(path.join(dir, 'b.ts'), 'export const x = 1;\n');
  assert.equal(cli(glob).code, 0);
  fs.rmSync(path.join(dir, 'a.ts'));
  const r = cli('--check', glob);
  assert.equal(r.code, 1);
  assert.match(r.out, /a\.defaults\.ts is stale: run tsdoc-defaults/);
  assert.equal(cli(glob).code, 0);
  assert.deepEqual(fs.readdirSync(dir), ['b.ts']);
});

void test('a .defaults.ts file without the generated header is never removed', () => {
  const dir = tmp();
  const source = path.join(dir, 'a.ts');
  const own = path.join(dir, 'a.defaults.ts');
  fs.writeFileSync(source, 'export const x = 1;\n');
  fs.writeFileSync(own, 'export const y = 2;\n');
  assert.equal(cli('--check', source).code, 0);
  assert.equal(cli(source).code, 0);
  fs.writeFileSync(source, SOURCE);
  const r = cli(source);
  assert.equal(r.code, 1);
  assert.match(
    r.out,
    /a\.defaults\.ts exists without the tsdoc-defaults header/,
  );
  assert.equal(fs.readFileSync(own, 'utf8'), 'export const y = 2;\n');
});

void test('a leftover shared by two sources is stale once', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.ts'), SOURCE);
  assert.equal(cli(path.join(dir, 'a.ts')).code, 0);
  fs.writeFileSync(path.join(dir, 'a.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(dir, 'a.tsx'), 'export const x = 1;\n');
  const r = cli('--check', path.join(dir, '*.ts*'));
  assert.equal(r.code, 1);
  assert.equal(r.out.match(/is stale/g)?.length, 1);
});

void test('sources sharing an output path', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.ts'), SOURCE);
  fs.writeFileSync(path.join(dir, 'a.d.ts'), 'export declare const z: 1;\n');
  assert.equal(cli(path.join(dir, '*.ts')).code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'a.defaults.ts')));
  fs.writeFileSync(path.join(dir, 'a.tsx'), SOURCE);
  const r = cli(path.join(dir, '*.ts*'));
  assert.equal(r.code, 1);
  assert.match(r.out, /a\.tsx:1:1 .*a\.ts also generates .*a\.defaults\.ts/);
});

void test('without globs, the tsconfig.json picks the sources and the import extension', () => {
  const cases: [object, string][] = [
    [{ module: 'nodenext' }, './a.js'],
    [{ module: 'nodenext', allowImportingTsExtensions: true }, './a.ts'],
    [{ module: 'preserve', moduleResolution: 'bundler' }, './a'],
  ];
  for (const [compilerOptions, specifier] of cases) {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/a.ts'), SOURCE);
    fs.writeFileSync(path.join(dir, 'b.ts'), SOURCE.replace('export ', ''));
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions, include: ['src'] }),
    );
    const r = cliIn(dir);
    assert.equal(r.code, 0, r.out);
    const text = fs.readFileSync(path.join(dir, 'src/a.defaults.ts'), 'utf8');
    assert.match(text, new RegExp(`from '${specifier}';`), specifier);
  }
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.ts'), SOURCE);
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { module: 'nodenext' }, include: [] }),
  );
  assert.equal(cliIn(dir, 'a.ts').code, 0);
  assert.match(
    fs.readFileSync(path.join(dir, 'a.defaults.ts'), 'utf8'),
    /from '\.\/a\.js';/,
  );
});

void test('--project resolves relative to its own directory', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'pkg/src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pkg/src/a.ts'), SOURCE);
  fs.writeFileSync(
    path.join(dir, 'pkg/tsconfig.build.json'),
    JSON.stringify({
      compilerOptions: { module: 'nodenext' },
      include: ['src'],
    }),
  );
  assert.equal(cliIn(dir, '-p', 'pkg/tsconfig.build.json').code, 0);
  assert.match(
    fs.readFileSync(path.join(dir, 'pkg/src/a.defaults.ts'), 'utf8'),
    /from '\.\/a\.js';/,
  );
  const r = cliIn(dir, '--project', 'nope.json');
  assert.equal(r.code, 2);
  assert.match(r.out, /^nope\.json: /);
});

void test('a tsconfig.json that includes nothing or does not parse is a usage error', () => {
  for (const [config, message] of [
    ['{ "include": ["nothing"] }', /includes no TypeScript files: pass globs/],
    ['{', /^tsconfig\.json: /],
    ['{ "compilerOptions": { "module": "bogus" } }', /^tsconfig\.json: /],
  ] as const) {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), config);
    const r = cliIn(dir);
    assert.equal(r.code, 2, config);
    assert.match(r.out, message, config);
  }
});
