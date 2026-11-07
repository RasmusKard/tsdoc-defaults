import ts from 'typescript';
import { parseDiagnostics } from './expressions.js';

// Fields `forEachChild` does not visit: `-1` and `+1` differ only in `operator`.
const SCALARS = [
  'operator',
  'keywordToken',
  'token',
  'isTypeOnly',
  'isTypeOf',
  'isExportEquals',
  'phaseModifier',
];
const FLAGS = ts.NodeFlags.BlockScoped | ts.NodeFlags.OptionalChain;

const unwrap = (n: ts.Node): ts.Node =>
  ts.isParenthesizedExpression(n)
    ? unwrap(n.expression)
    : ts.isParenthesizedTypeNode(n)
      ? unwrap(n.type)
      : n;

/** A property name's value, so `'k'`, `"k"` and `k` match; undefined for any other node. */
function keyText(n: ts.Node): string | undefined {
  const isName = (n.parent as { name?: ts.Node }).name === n;
  return isName &&
    (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n))
    ? n.text
    : undefined;
}

/** A node's `text`; a regex's with its flags sorted (Prettier sorts them); a template's raw text (a tag reads it). */
function textOf(n: ts.Node): unknown {
  // TypeScript keeps CRLF in raw text; the language reads it as LF.
  if (ts.isTemplateLiteralToken(n)) return n.rawText?.replace(/\r\n?/g, '\n');
  if (!ts.isRegularExpressionLiteral(n)) return (n as { text?: unknown }).text;
  const flags = n.text.lastIndexOf('/') + 1;
  return n.text.slice(0, flags) + [...n.text.slice(flags)].sort().join('');
}

function children(n: ts.Node): ts.Node[] {
  const out: ts.Node[] = [];
  // A block body: `forEachChild` stops at the first truthy return.
  n.forEachChild((c) => {
    out.push(unwrap(c));
  });
  return out;
}

function sameChildren(a: ts.Node, b: ts.Node): boolean {
  const ca = children(a);
  const cb = children(b);
  return ca.length === cb.length && ca.every((c, i) => sameNode(c, cb[i]));
}

function sameNode(a: ts.Node, b: ts.Node): boolean {
  const ka = keyText(a);
  const kb = keyText(b);
  if (ka !== undefined || kb !== undefined) return ka === kb;
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  return (
    a.kind === b.kind &&
    (a.flags & FLAGS) === (b.flags & FLAGS) &&
    textOf(a) === textOf(b) &&
    SCALARS.every((k) => x[k] === y[k]) &&
    sameChildren(a, b)
  );
}

/**
 * Whether two module texts have the same syntax tree, ignoring what a formatter changes: whitespace,
 * comments, semicolons, trailing commas, redundant parentheses, quote style, quotes around property names and the
 * order of regex flags.
 * Literals compare by value, templates by raw text. A text with syntax errors never matches.
 */
export function sameSyntax(a: string, b: string): boolean {
  const [x, y] = [a, b].map((text) =>
    ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true),
  );
  // Not `sameNode`: a source file's `text` is its whole, formatted text.
  return (
    !parseDiagnostics(x).length &&
    !parseDiagnostics(y).length &&
    sameChildren(x, y)
  );
}
