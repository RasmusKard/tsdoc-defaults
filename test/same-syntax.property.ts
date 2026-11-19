// Property-based verification of `sameSyntax`, the comparison behind `--check`. Run: npm run verify.
// The skill in .claude/skills/verify-check-comparison/SKILL.md explains the properties and how to read a failure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspect } from 'node:util';
import vm from 'node:vm';
import fc from 'fast-check';
import * as prettier from 'prettier';
import ts from 'typescript';
import { sameSyntax } from '../src/compare.js';
import { parseDefault, parseDiagnostics } from '../src/expressions.js';
import { renderModule } from '../src/render.js';

// A default's value, generated as a tree and printed with random spellings (see `Printer`).
type Key = { t: 'key'; v: string };
type Item = Expr | { t: 'hole' } | { t: 'spread'; e: Expr };
type Prop = { t: 'prop'; k: Key; e: Expr } | { t: 'spread'; e: Expr };
type Expr =
  | { t: 'num'; v: number }
  | { t: 'big'; v: bigint }
  | { t: 'str'; v: string }
  | { t: 'raw'; v: string }
  | { t: 're'; src: string; flags: string }
  | { t: 'kw'; v: string }
  | { t: 'un'; op: string; e: Expr }
  | { t: 'bin'; op: string; l: Expr; r: Expr }
  | { t: 'cond'; c: Expr; a: Expr; b: Expr }
  | { t: 'arr'; items: Item[] }
  | { t: 'obj'; props: Prop[] }
  | { t: 'tpl'; head: string; spans: [Expr, string][] }
  | { t: 'get'; e: Expr; k: Key | Expr; opt: boolean }
  | { t: 'call'; fn: string; args: Expr[] }
  | { t: 'new'; ctor: string; args: Expr[] }
  | { t: 'cast'; e: Expr; how: string }
  | { t: 'seq'; l: Expr; r: Expr };

const NUMS = [0, 1, 2, 10, 16, 255, 1000, 0.5, 1.5, 1e21, 1e-7, 1e400];
const BIGS = [0n, 1n, 16n, 255n];
const CHARS = [
  'a',
  'A',
  ' ',
  "'",
  '"',
  '\\',
  '\n',
  '\r',
  '`',
  '$',
  '{',
  'é',
  '😀',
  ' ',
];
// Raw template text, kept as written: `String.raw` reads it.
const RAW = ['a', 'A', '\\x41', '\\n', '\\\\', '\n', '\\u', '$', '{', '\\`'];
const REGEX = ['a', 'a+', '[ab]', '\\d', '\\/', '.'];
const FLAGS = ['g', 'i', 'm', 's', 'u', 'y'];
const KEYWORDS = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];
const KEYS = [
  'a',
  'b',
  '__proto__',
  'constructor',
  'length',
  '0',
  '1',
  '16',
  '1.5',
  '0x10',
  '',
  'a-b',
];
const UNARY = ['-', '+', '!', '~', 'typeof', 'void'];
const BINARY = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '**',
  '&',
  '|',
  '^',
  '<<',
  '>>',
  '>>>',
  '&&',
  '||',
  '??',
  '===',
  '!==',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
];
const CALLS = [
  'Math.max',
  'Math.min',
  'String',
  'Number',
  'Boolean',
  'Array.of',
  'Object.keys',
  'JSON.stringify',
];
// No `Date`: `new Date()` reads the clock.
const CTORS = ['Map', 'Set', 'String', 'Number', 'Array'];
const CASTS = [
  'as number',
  'as const',
  'as unknown as string',
  'satisfies unknown',
  '!',
  '<number>',
];
const MEMBERS = ['a', "'a'", '"a"', 'b', '0', "'0'", "'a-b'", 'timeoutMs'];

const key = fc.constantFrom(...KEYS).map((v): Key => ({ t: 'key', v }));
const str = fc
  .array(fc.constantFrom(...CHARS), { maxLength: 3 })
  .map((cs) => cs.join(''));

const { expr } = fc.letrec<{ expr: Expr }>((tie) => {
  const e = tie('expr');
  const some = fc.array(e, { maxLength: 2 });
  return {
    expr: fc.oneof(
      { maxDepth: 3, depthSize: 'small', withCrossShrink: true },
      fc.constantFrom(...NUMS).map((v): Expr => ({ t: 'num', v })),
      fc.constantFrom(...BIGS).map((v): Expr => ({ t: 'big', v })),
      str.map((v): Expr => ({ t: 'str', v })),
      fc
        .array(fc.constantFrom(...RAW), { maxLength: 3 })
        .map((cs): Expr => ({ t: 'raw', v: cs.join('') })),
      fc
        .record({ src: fc.constantFrom(...REGEX), flags: fc.subarray(FLAGS) })
        .map(({ src, flags }): Expr => ({
          t: 're',
          src,
          flags: flags.join(''),
        })),
      fc.constantFrom(...KEYWORDS).map((v): Expr => ({ t: 'kw', v })),
      fc.record({
        t: fc.constant('un' as const),
        op: fc.constantFrom(...UNARY),
        e,
      }),
      fc.record({
        t: fc.constant('bin' as const),
        op: fc.constantFrom(...BINARY),
        l: e,
        r: e,
      }),
      fc.record({ t: fc.constant('cond' as const), c: e, a: e, b: e }),
      fc.record({
        t: fc.constant('arr' as const),
        items: fc.array(
          fc.oneof(
            e,
            fc.constant({ t: 'hole' as const }),
            fc.record({ t: fc.constant('spread' as const), e }),
          ),
          { maxLength: 3 },
        ),
      }),
      fc.record({
        t: fc.constant('obj' as const),
        props: fc.array(
          fc.oneof(
            fc.record({ t: fc.constant('prop' as const), k: key, e }),
            fc.record({ t: fc.constant('spread' as const), e }),
          ),
          { maxLength: 3 },
        ),
      }),
      fc.record({
        t: fc.constant('tpl' as const),
        head: str,
        spans: fc.array(fc.tuple(e, str), { minLength: 1, maxLength: 2 }),
      }),
      {
        // Weighted and with nullish bases so chains like `(null?.a).b` (throws) vs `null?.a.b` (does not) come up.
        weight: 4,
        arbitrary: fc.record({
          t: fc.constant('get' as const),
          e: fc.oneof(
            e,
            fc.constantFrom<Expr>(
              { t: 'kw', v: 'null' },
              { t: 'kw', v: 'undefined' },
            ),
          ),
          k: fc.oneof(key, e),
          opt: fc.boolean(),
        }),
      },
      fc.record({
        t: fc.constant('call' as const),
        fn: fc.constantFrom(...CALLS),
        args: some,
      }),
      fc.record({
        t: fc.constant('new' as const),
        ctor: fc.constantFrom(...CTORS),
        args: some,
      }),
      fc.record({
        t: fc.constant('cast' as const),
        e,
        how: fc.constantFrom(...CASTS),
      }),
      fc.record({ t: fc.constant('seq' as const), l: e, r: e }),
    ),
  };
});

/**
 * Prints a tree as TypeScript, choosing among spellings with the same meaning (number bases, quotes, escapes,
 * key forms, parentheses, whitespace, comments, regex flag order) from a seeded stream. With `mutation` above 0
 * it also changes values, operators and keys at that rate, so two printings of one tree may or may not mean the same.
 */
class Printer {
  private state: number;
  constructor(
    seed: number,
    private readonly mutation = 0,
  ) {
    this.state = seed >>> 0;
  }

  /** mulberry32 */
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chance = (p: number) => this.next() < p;
  pick = <T>(xs: readonly T[]): T => xs[Math.floor(this.next() * xs.length)];
  mutate = () => this.chance(this.mutation);

  ws = () => this.pick(['', '', ' ', ' ', '\n', ' /* c */ ', ' // c\n']);
  /** Child of an operator: parenthesized unless the coin says to rely on precedence. */
  sub = (e: Expr) => this.paren(this.expr(e), this.chance(0.5));
  paren = (s: string, force = false) =>
    force || this.chance(0.1) ? `(${this.ws()}${s}${this.ws()})` : s;
  list = (xs: string[]) =>
    xs.join(`,${this.ws()}`) + (xs.length && this.chance(0.3) ? ',' : '');

  expr(e: Expr): string {
    return this.paren(PRINT[e.t](e as never, this));
  }

  num(v: number): string {
    const forms = [
      String(v),
      v.toExponential(),
      v.toExponential().toUpperCase(),
    ];
    if (Number.isInteger(v) && v < 2 ** 53)
      forms.push(
        `0x${v.toString(16)}`,
        `0X${v.toString(16).toUpperCase()}`,
        `0o${v.toString(8)}`,
        `0b${v.toString(2)}`,
        `${v}.`,
        `${v}.0`,
        `${v}E+0`,
        String(v).replace(/\B(?=(\d{3})+$)/g, '_'),
      );
    if (v > 0 && v < 1) forms.push(String(v).slice(1), `${v}0`);
    return this.pick(forms);
  }

  big(v: bigint): string {
    return this.pick([
      `${v}n`,
      `0x${v.toString(16)}n`,
      `0X${v.toString(16).toUpperCase()}n`,
      `0o${v.toString(8)}n`,
      `0b${v.toString(2)}n`,
    ]);
  }

  /** A string's content between `quote`s; escapes chosen at random, line continuations sprinkled in. */
  text(s: string, quote: string): string {
    return [...s]
      .map((ch) => this.char(ch, quote) + (this.chance(0.1) ? '\\\n' : ''))
      .join('');
  }

  private char(ch: string, quote: string): string {
    const cp = ch.codePointAt(0)!;
    const hex = (n: number, w: number) => n.toString(16).padStart(w, '0');
    const units = ch.length === 2 ? [ch.charCodeAt(0), ch.charCodeAt(1)] : [cp];
    const forms = [
      units.map((u) => `\\u${hex(u, 4)}`).join(''),
      `\\u{${hex(cp, 1)}}`,
    ];
    if (cp < 256) forms.push(`\\x${hex(cp, 2)}`);
    const single: Record<string, string> = {
      '\n': '\\n',
      '\r': '\\r',
      '\\': '\\\\',
      "'": "\\'",
      '"': '\\"',
      '`': '\\`',
    };
    if (single[ch]) forms.push(single[ch]);
    if (/[a-zA-Z{ ]/.test(ch) && !/[bfnrtvux]/.test(ch)) forms.push(`\\${ch}`);
    const literal =
      quote === '`'
        ? !'`\\\r$'.includes(ch)
        : ![quote, '\\', '\n', '\r'].includes(ch);
    if (literal) forms.push(ch, ch, ch);
    return this.pick(forms);
  }

  str(s: string): string {
    const q = this.pick(["'", '"', '`']);
    return q + this.text(s, q) + q;
  }

  key(k: Key): string {
    const forms = [`'${this.text(k.v, "'")}'`, `"${this.text(k.v, '"')}"`];
    if (/^[a-z_]+$/.test(k.v))
      forms.push(
        k.v,
        k.v,
        `\\u00${k.v.charCodeAt(0).toString(16)}${k.v.slice(1)}`,
      );
    if (k.v && String(Number(k.v)) === k.v) forms.push(this.num(Number(k.v)));
    if (this.chance(0.1)) forms.push(`[${this.str(k.v)}]`);
    return this.pick(forms);
  }

  /** `k` itself, or another key when mutating. */
  keyOf = (k: Key): Key =>
    this.mutate() ? { t: 'key', v: this.pick(KEYS) } : k;
  /** `xs` itself, or one entry dropped or repeated when mutating. */
  some<T>(xs: T[]): T[] {
    if (!this.mutate() || !xs.length) return xs;
    const i = Math.floor(this.next() * xs.length);
    return this.chance(0.5)
      ? xs.filter((_, j) => j !== i)
      : [...xs.slice(0, i + 1), ...xs.slice(i)];
  }
  /** `s` itself, or with one character dropped, added or replaced when mutating. */
  edit(s: string, alphabet: readonly string[]): string {
    if (!this.mutate()) return s;
    const cs = [...s];
    const i = Math.floor(this.next() * (cs.length + 1));
    cs.splice(
      i,
      this.chance(0.5) ? 1 : 0,
      ...(this.chance(0.7) ? [this.pick(alphabet)] : []),
    );
    return cs.join('');
  }
  /** `v` itself, or another entry of `xs` when mutating. */
  swap = <T>(v: T, xs: readonly T[]): T => (this.mutate() ? this.pick(xs) : v);
}

const PRINT: {
  [K in Expr['t']]: (e: Extract<Expr, { t: K }>, p: Printer) => string;
} = {
  num: (e, p) => p.num(p.swap(e.v, NUMS)),
  big: (e, p) => p.big(p.swap(e.v, BIGS)),
  str: (e, p) => p.str(p.edit(e.v, CHARS)),
  // Raw text is the value; only the line break's spelling may vary (the language reads CRLF and CR as LF).
  raw: (e, p) =>
    `String.raw\`${p.edit(e.v, RAW).replace(/\n/g, () => p.pick(['\n', '\r\n', '\r']))}\``,
  re: (e, p) => {
    const flags = [...p.edit(e.flags, FLAGS)].sort(() => p.pick([-1, 1]));
    return `/${p.swap(e.src, REGEX)}/${flags.join('')}`;
  },
  kw: (e, p) => p.swap(e.v, KEYWORDS),
  un: (e, p) =>
    `${p.swap(e.op, UNARY)}${/\w/.test(e.op) ? ' ' : p.ws()}${p.sub(e.e)}`,
  bin: (e, p) =>
    `${p.sub(e.l)}${p.ws()} ${p.swap(e.op, BINARY)} ${p.ws()}${p.sub(e.r)}`,
  cond: (e, p) =>
    `${p.sub(e.c)} ?${p.ws()}${p.sub(e.a)} :${p.ws()}${p.sub(e.b)}`,
  arr: (e, p) =>
    `[${p.list(p.some(e.items).map((i) => (i.t === 'hole' ? '' : i.t === 'spread' ? `...${p.sub(i.e)}` : p.expr(i))))}]`,
  obj: (e, p) =>
    `{${p.ws()}${p.list(p.some(e.props).map((i) => (i.t === 'spread' ? `...${p.sub(i.e)}` : `${p.key(p.keyOf(i.k))}:${p.ws()}${p.expr(i.e)}`)))}${p.ws()}}`,
  tpl: (e, p) =>
    '`' +
    p.text(p.edit(e.head, CHARS), '`') +
    e.spans
      .map(
        ([x, s]) =>
          `\${${p.ws()}${p.expr(x)}${p.ws()}}${p.text(p.edit(s, CHARS), '`')}`,
      )
      .join('') +
    '`',
  get: (e, p) => {
    const opt = p.swap(e.opt, [true, false]) ? '?.' : '';
    const k = e.k.t === 'key' ? p.keyOf(e.k) : e.k;
    const dot = k.t === 'key' && /^[a-z_]+$/.test(k.v) && p.chance(0.7);
    if (dot) return `${p.sub(e.e)}${p.ws()}${opt || '.'}${k.v}`;
    return `${p.sub(e.e)}${opt}[${k.t === 'key' ? p.str(k.v) : p.expr(k)}]`;
  },
  call: (e, p) =>
    `${p.swap(e.fn, CALLS)}${p.chance(0.2) ? '?.' : ''}(${p.list(p.some(e.args).map((a) => p.expr(a)))})`,
  new: (e, p) => {
    const args = p.some(e.args);
    const call =
      args.length || p.chance(0.5)
        ? `(${p.list(args.map((a) => p.expr(a)))})`
        : '';
    return `new ${p.swap(e.ctor, CTORS)}${call}`;
  },
  cast: (e, p) => {
    const how = p.swap(e.how, CASTS);
    return how === '<number>'
      ? `<number>${p.sub(e.e)}`
      : `${p.sub(e.e)}${how === '!' ? '' : ' '}${how}`;
  },
  seq: (e, p) => `${p.sub(e.l)},${p.ws()}${p.sub(e.r)}`,
};

/** A generated module for `members`, as `generate` writes it; undefined if a default is not one expression. */
function moduleFor(members: [string, string][]): string | undefined {
  const parsed = members.map(
    ([member, text]) =>
      [member, parseDefault({ form: 'code', text }, new Set())] as const,
  );
  if (!parsed.every(([, d]) => d.kind === 'code')) return undefined;
  return renderModule('options.ts', './options.js', {
    members: parsed.map(([member, d]) => ({
      declaration: 'Options',
      member,
      expression: d.kind === 'code' ? d.expression : '',
    })),
    imports: [],
    directives: [],
  });
}

/**
 * What loading a module yields: its `DEFAULTS`, printed exactly (key order, prototypes, -0, holes), or the error
 * it throws. Undefined if it is not valid JavaScript (`0 ?? 1 || 2`, `++0`): the TypeScript parser accepts some
 * such texts and leaves them to the type checker, so they have no meaning to compare.
 */
function evaluate(module: string): string | undefined {
  const js = ts.transpileModule(module, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: { DEFAULTS?: unknown } = {};
  let run: (x: object) => void;
  try {
    run = vm.runInThisContext(`(function (exports) {${js}\n})`) as typeof run;
  } catch (e) {
    if (e instanceof SyntaxError) return undefined;
    throw e;
  }
  try {
    run(exports);
  } catch (e) {
    return `throws ${(e as Error).name}`;
  }
  return inspect(exports.DEFAULTS, {
    depth: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    breakLength: Infinity,
    showHidden: true,
  });
}

const members = fc.uniqueArray(fc.tuple(fc.constantFrom(...MEMBERS), expr), {
  minLength: 1,
  maxLength: 2,
  selector: ([m]) => m.replace(/['"]/g, ''),
});
const seed = fc.noBias(fc.integer());
const RUNS = Number(process.env.VERIFY_RUNS) || 10000;

void test('--check never calls a file fresh when its DEFAULTS would differ', () => {
  let same = 0;
  fc.assert(
    fc.property(
      members,
      seed,
      seed,
      fc.constantFrom(0, 0.05, 0.2),
      (ms, s1, s2, mutation) => {
        const a = new Printer(s1);
        const b = new Printer(s2, mutation);
        const disk = moduleFor(ms.map(([m, e]) => [m, a.expr(e)]));
        const fresh = moduleFor(
          ms.map(([m, e]) => [b.swap(m, MEMBERS), b.expr(e)]),
        );
        fc.pre(disk !== undefined && fresh !== undefined);
        if (!sameSyntax(disk, fresh)) return;
        const [x, y] = [evaluate(disk), evaluate(fresh)];
        fc.pre(x !== undefined && y !== undefined);
        if (disk !== fresh) same++;
        assert.equal(
          y,
          x,
          `sameSyntax called these the same:\n--- on disk\n${disk}\n--- regenerated\n${fresh}`,
        );
      },
    ),
    { numRuns: RUNS },
  );
  // Guards the generator: the implication above is only tested when sameSyntax says "same" for different texts.
  assert.ok(
    same > RUNS / 10,
    `only ${same} runs compared differently spelled modules as the same`,
  );
});

void test('--check ignores what Prettier changes in a generated file', async () => {
  const options = fc.record({
    singleQuote: fc.boolean(),
    quoteProps: fc.constantFrom('as-needed', 'consistent', 'preserve'),
    trailingComma: fc.constantFrom('all', 'es5', 'none'),
    semi: fc.boolean(),
    bracketSpacing: fc.boolean(),
    objectWrap: fc.constantFrom('preserve', 'collapse'),
    arrowParens: fc.constantFrom('always', 'avoid'),
    printWidth: fc.integer({ min: 20, max: 120 }),
  });
  await fc.assert(
    fc.asyncProperty(members, seed, options, async (ms, s, opts) => {
      const p = new Printer(s);
      const text = moduleFor(ms.map(([m, e]) => [m, p.expr(e)]));
      const before = text === undefined ? undefined : evaluate(text);
      fc.pre(text !== undefined && before !== undefined);
      // Prettier rejects some texts TypeScript parses (`{ a: 0, f() }`) and breaks others (it moves a `// c` into
      // a string that ends a line with `\`, or writes `(<number>0) ** 0` as `<number>0 ** 0`, a syntax error); neither
      // says anything about sameSyntax, so both are skipped.
      const formatted = await prettier
        .format(text, { ...opts, parser: 'typescript' })
        .catch((e: unknown) => {
          // Prettier's parse errors are plain Errors named SyntaxError.
          if (e instanceof Error && e.name === 'SyntaxError') return undefined;
          throw e;
        });
      fc.pre(
        formatted !== undefined &&
          !parseDiagnostics(
            ts.createSourceFile('x.ts', formatted, ts.ScriptTarget.Latest),
          ).length &&
          evaluate(formatted) === before,
      );
      assert.ok(
        sameSyntax(text, formatted),
        `generated:\n${text}\n--- after prettier ${JSON.stringify(opts)}:\n${formatted}`,
      );
    }),
    { numRuns: Math.ceil(RUNS / 6) },
  );
});
