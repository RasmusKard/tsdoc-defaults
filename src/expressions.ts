import ts from 'typescript';
import type { ClassifiedTag } from './tags.js';

const DIRECTIVE = /^\/\/[ \t]*tsdoc-defaults:(.*)$/;

/** The global values the language itself defines; a bare expression reading any other global is prose. */
export const KNOWN_GLOBALS = new Set([
  'undefined',
  'NaN',
  'Infinity',
  'globalThis',
]);

export type Scope = {
  /** Local binding name to the import statement that binds it. */
  imports: Map<string, string>;
  /** Names of top-level declarations in the file, excluding ones a directive binds. */
  locals: Set<string>;
  /** Import statements from `// tsdoc-defaults:` directives, verbatim and deduplicated. */
  directives: string[];
  /** Names a bare expression may read: imported, directive-bound or a known global. */
  known: Set<string>;
};

export type ParsedDefault =
  | { kind: 'code'; expression: string; ids: string[] }
  | { kind: 'prose' }
  | { kind: 'error'; message: string };

export type Fail = (pos: number, message: string) => void;

/** Reads the file's imports, locals and directives; malformed directives are reported through `fail`. */
export function scopeOf(sf: ts.SourceFile, fail: Fail): Scope {
  const imports = new Map<string, string>();
  const locals = new Set<string>();
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s))
      importBindings(s, sf).forEach(([name, stmt]) => imports.set(name, stmt));
    else if (ts.isImportEqualsDeclaration(s))
      imports.set(s.name.text, s.getText(sf));
    else localNames(s).forEach((n) => locals.add(n));
  }
  const directives: string[] = [];
  const known = new Set([...KNOWN_GLOBALS, ...imports.keys()]);
  for (const [pos, text] of directiveComments(sf)) {
    const bindings = directiveBindings(text);
    if (!bindings)
      fail(
        pos,
        'malformed directive: a tsdoc-defaults comment must be one import statement',
      );
    else if (!directives.some((d) => sameStatement(d, text)))
      directives.push(text);
    bindings?.forEach((name) => {
      known.add(name);
      locals.delete(name);
    });
  }
  return { imports, locals, directives, known };
}

const sameStatement = (a: string, b: string) =>
  a.replace(/;$/, '') === b.replace(/;$/, '');

/** Position and text of every `// tsdoc-defaults:` line comment; the scanner skips mentions in strings and block comments. */
function directiveComments(sf: ts.SourceFile): [number, string][] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    sf.languageVariant,
    sf.text,
  );
  const out: [number, string][] = [];
  // shortcut: a template literal with `${}` desyncs the scanner until the next backtick; rescan if a real file hits it
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    if (scanner.getToken() !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
    const m = DIRECTIVE.exec(scanner.getTokenText());
    if (m) out.push([scanner.getTokenStart(), m[1].trim()]);
  }
  return out;
}

/** The names one directive binds, or undefined if it is not a single import statement. */
function directiveBindings(text: string): string[] | undefined {
  const sf = ts.createSourceFile(
    'directive.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const [stmt] = sf.statements;
  if (
    sf.statements.length !== 1 ||
    !stmt ||
    !ts.isImportDeclaration(stmt) ||
    parseDiagnostics(sf).length
  )
    return undefined;
  return importBindings(stmt, sf).map(([name]) => name);
}

function importBindings(
  s: ts.ImportDeclaration,
  sf: ts.SourceFile,
): [string, string][] {
  const clause = s.importClause;
  if (!clause) return [];
  const from =
    s.moduleSpecifier.getText(sf) +
    (s.attributes ? ` ${s.attributes.getText(sf)}` : '') +
    ';';
  const type = clause.isTypeOnly ? 'type ' : '';
  const out: [string, string][] = [];
  if (clause.name)
    out.push([
      clause.name.text,
      `import ${type}${clause.name.text} from ${from}`,
    ]);
  const nb = clause.namedBindings;
  if (nb && ts.isNamespaceImport(nb))
    out.push([nb.name.text, `import ${type}* as ${nb.name.text} from ${from}`]);
  else
    nb?.elements.forEach((el) =>
      out.push([
        el.name.text,
        `import ${type}{ ${el.getText(sf)} } from ${from}`,
      ]),
    );
  return out;
}

function localNames(s: ts.Statement): string[] {
  // shortcut: destructured top-level consts are not detected as locals; add if a real codebase needs it
  if (ts.isVariableStatement(s))
    return s.declarationList.declarations.flatMap((d) =>
      ts.isIdentifier(d.name) ? [d.name.text] : [],
    );
  if (
    (ts.isFunctionDeclaration(s) ||
      ts.isClassDeclaration(s) ||
      ts.isEnumDeclaration(s) ||
      ts.isInterfaceDeclaration(s) ||
      ts.isTypeAliasDeclaration(s)) &&
    s.name
  )
    return [s.name.text];
  return [];
}

const parseDiagnostics = (sf: ts.SourceFile) =>
  (sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics;

/** Parses `text` wrapped in parentheses; the newline lets it end in a line comment. */
export const parseExpression = (text: string) =>
  ts.createSourceFile('x.ts', `(${text}\n);`, ts.ScriptTarget.Latest, true);

/**
 * Parses a classified tag. A code span or fence must parse as one expression or it is an error; bare text
 * that does not parse, or that reads a name not in `known` (`100 (ms)`, `none`), is prose.
 * The expression is the tag text without surrounding whitespace and comments; `ids` are the names it reads.
 */
export function parseDefault(
  tag: ClassifiedTag,
  known: ReadonlySet<string>,
): ParsedDefault {
  const parsed = parseExpression(tag.text);
  const expr = wholeExpression(parsed);
  if (!expr)
    return tag.form === 'bare'
      ? { kind: 'prose' }
      : {
          kind: 'error',
          message: 'the code in the default tag is not one expression',
        };
  const ids = freeIdentifiers(parsed);
  if (tag.form === 'bare' && ids.some((id) => !known.has(id)))
    return { kind: 'prose' };
  return {
    kind: 'code',
    // `- 1`: positions in `parsed` count the `(` that `parseExpression` adds.
    expression: tag.text.slice(expr.getStart(parsed) - 1, expr.end - 1),
    ids,
  };
}

/** The expression inside the added parentheses, or undefined when the text is not exactly one expression. */
function wholeExpression(sf: ts.SourceFile): ts.Expression | undefined {
  const [s] = sf.statements;
  const paren = s && ts.isExpressionStatement(s) ? s.expression : undefined;
  // `1) + (2` also parses inside the added parentheses: require the expression to end at the added `;`.
  return !parseDiagnostics(sf).length &&
    sf.statements.length === 1 &&
    paren &&
    ts.isParenthesizedExpression(paren) &&
    paren.end === sf.text.length - 1
    ? paren.expression
    : undefined;
}

/** Identifiers an expression reads from its enclosing scope (not property names, not names it declares itself). */
function freeIdentifiers(sf: ts.SourceFile): string[] {
  const used = new Set<string>();
  const declared = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n))
      (isReference(n) ? used : isDeclaration(n) ? declared : new Set()).add(
        n.text,
      );
    n.forEachChild(visit);
  };
  visit(sf);
  // shortcut: scope-insensitive, a name declared anywhere in the expression is never free; fine for default values
  return [...used].filter((id) => !declared.has(id));
}

function isReference(n: ts.Identifier): boolean {
  const p = n.parent as ts.Node & { name?: ts.Node; propertyName?: ts.Node };
  return (
    (p.name !== n &&
      p.propertyName !== n &&
      !(ts.isQualifiedName(p) && p.right === n)) ||
    ts.isShorthandPropertyAssignment(p)
  );
}

function isDeclaration(n: ts.Identifier): boolean {
  const p = n.parent;
  return (
    ts.isParameter(p) ||
    ts.isBindingElement(p) ||
    ts.isFunctionExpression(p) ||
    ts.isClassExpression(p)
  );
}
