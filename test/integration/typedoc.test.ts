import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Application, Comment, CommentTag, type NormalizedPath } from 'typedoc';
import { defaultExpression, load } from '../../src/typedoc.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
const fixture = path.join(root, 'test/fixtures/typedoc');
const entry = path.join(fixture, 'options.ts');
const tsconfig = path.join(fixture, 'tsconfig.json');

type Node = {
  name: string;
  children?: Node[];
  defaultValue?: string;
  comment?: { blockTags?: { tag: string }[] };
};
const find = (n: Node, name: string): Node | undefined =>
  n.name === name ? n : n.children?.map((c) => find(c, name)).find(Boolean);
const member = (json: Node, name: string) => {
  const found = find(find(json, 'BridgeOptions')!, name);
  assert.ok(found, `${name} not in the TypeDoc output`);
  return found;
};
const tags = (n: Node) => (n.comment?.blockTags ?? []).map((t) => t.tag);

async function convert(plugin: boolean) {
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [entry],
    tsconfig,
    plugin: plugin ? [path.join(root, 'src/typedoc.ts')] : [],
    logLevel: 'Error',
  });
  const project = await app.convert();
  assert.ok(project);
  const json = JSON.parse(
    JSON.stringify(
      app.serializer.projectToObject(project, root as NormalizedPath),
    ),
  ) as Node;
  return json;
}

void test('classifies tag content like the core', () => {
  const cases: [string, string | undefined][] = [
    ['`10_000`', '10_000'],
    ['```ts\n{ a: 1 }\n```', '{ a: 1 }'],
    ['14', '14'],
    ['undefined', 'undefined'],
    ['__DEV__', undefined],
    ['`[1, 2`', undefined],
    ['```ts\nnone\n```', undefined],
  ];
  for (const [text, expected] of cases)
    assert.equal(defaultExpression(text), expected, text);
});

void test('plugin moves expression defaults into defaultValue and leaves prose alone', async () => {
  const json = await convert(true);
  const expected = {
    timeoutMs: '10_000',
    fit: "'cover'",
    logLevel: "__DEV__ ? 'debug' : 'warn'",
    fontSize: '14',
    retry: '{ retries: 3, backoff: (n: number) => n * 2 }',
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(member(json, name).defaultValue, value, name);
    assert.deepEqual(tags(member(json, name)), [], name);
  }
  assert.equal(member(json, 'accent').defaultValue, undefined);
  assert.deepEqual(tags(member(json, 'accent')), ['@default']);
  assert.equal(member(json, 'width').defaultValue, undefined);
  assert.deepEqual(tags(member(json, 'width')), ['@defaultValue']);
  assert.equal(member(json, 'name').defaultValue, undefined);
});

void test('plugin works on reflections from another TypeDoc copy', () => {
  let resolveBegin: (context: unknown) => void = () => {};
  const app = {
    converter: {
      on: (_: string, fn: typeof resolveBegin) => (resolveBegin = fn),
    },
  };
  load(app as unknown as Application);
  // A plain object stands in for a DeclarationReflection the plugin's own `typedoc` import didn't create.
  const r: {
    defaultValue?: string;
    isDeclaration: () => boolean;
    comment: Comment;
  } = {
    isDeclaration: () => true,
    comment: new Comment(
      [],
      [new CommentTag('@default', [{ kind: 'code', text: '`5`' }])],
    ),
  };
  resolveBegin({ project: { getReflectionsByKind: () => [r] } });
  assert.equal(r.defaultValue, '5');
  assert.deepEqual(r.comment.blockTags, []);
});
