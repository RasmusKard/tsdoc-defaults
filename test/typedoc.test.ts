import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Application, Comment, CommentTag, type NormalizedPath } from 'typedoc';
import { defaultExpression, load } from '../src/typedoc.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const fx = path.join(root, 'test/fixtures');

type Node = {
  name: string;
  children?: Node[];
  defaultValue?: string;
  comment?: { blockTags?: { tag: string }[] };
};

void test('moves expression defaults into defaultValue and leaves prose alone', async () => {
  const app = await Application.bootstrapWithPlugins({
    entryPoints: [path.join(fx, 'basic.ts')],
    tsconfig: path.join(fx, 'tsconfig.json'),
    plugin: [path.join(root, 'src/typedoc.ts')],
    logLevel: 'Error',
  });
  const project = await app.convert();
  assert.ok(project);
  const json = JSON.parse(
    JSON.stringify(
      app.serializer.projectToObject(project, root as NormalizedPath),
    ),
  ) as Node;
  const bridge = json.children!.find((c) => c.name === 'BridgeOptions')!;
  assert.deepEqual(
    Object.fromEntries(
      bridge.children!.map((c) => [
        c.name,
        [c.defaultValue, (c.comment?.blockTags ?? []).map((t) => t.tag)],
      ]),
    ),
    {
      0: ['2', []],
      accent: [undefined, ['@default']],
      agent: ['undefined', []],
      banner: ['`line1\n  line2`', []],
      'data-enabled': ['true', []],
      fit: ["'cover'", []],
      label: ["`${'a'}b`", []],
      name: [undefined, []],
      retries: ['3', []],
      timeoutMs: ['10_000', []],
      webView: ['{ customUserAgent: null, inspectable: __DEV__ }', []],
    },
  );
});

void test('a code span that is not one expression is prose, not an error', () => {
  assert.equal(defaultExpression('`[1, 2`'), undefined);
});

void test('works on reflections from another TypeDoc copy', () => {
  let resolveBegin: (context: unknown) => void = () => {};
  const app = {
    converter: {
      on: (_: string, fn: typeof resolveBegin) => (resolveBegin = fn),
    },
  };
  load(app as unknown as Application);
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
