import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { sameSyntax } from './compare.js';
import { parseDefault, scopeOf } from './expressions.js';
import { renderModule } from './render.js';
import {
  classifyTag,
  strayCodeTags,
  tagText,
  taggedMembers,
  type Decl,
} from './tags.js';

/** One member whose default tag holds code. */
export interface DefaultMember {
  /** Name of the interface or type alias that declares the member. */
  declaration: string;
  /** The member's name as written in the source, quotes included. */
  member: string;
  /** The default's expression as written in the tag, without surrounding whitespace and comments. */
  expression: string;
}

/** A problem that stops generation. Line and column are 1-based. */
export interface ExtractError {
  /** The source file, as given. */
  file: string;
  line: number;
  column: number;
  /** What is wrong, prefixed with `Declaration.member:` when it concerns one member. */
  message: string;
}

/** What `extractDefaults` found in one source file. */
export interface ExtractResult {
  /** The members with a code default, in source order. */
  members: DefaultMember[];
  /** Import statements copied from the source file because a default reads one of their bindings. */
  imports: string[];
  /** Import statements from `// tsdoc-defaults:` directives, verbatim. */
  directives: string[];
  /** Every problem found; when non-empty the other fields are incomplete. */
  errors: ExtractError[];
}

/** Options of `generate` and `check`. */
export interface GenerateOptions {
  /** Appended to the generated file's import of its source, e.g. `.js` for `moduleResolution: nodenext`. Default: none, except `.mjs`/`.cjs` for a `.mts`/`.cts` source, which cannot be imported without it. */
  importExt?: string;
}

/** The text of one generated module and where it belongs. */
export interface GeneratedFile {
  /** The source file, as given. */
  source: string;
  /** The sibling output path, see `outputPath`. */
  output: string;
  /** The module's full text, LF line endings, ending in a newline. */
  text: string;
}

/** What `generate` produced for a set of source files. */
export interface GenerateResult {
  /** One entry per source file with at least one code default; empty when `errors` is not. */
  files: GeneratedFile[];
  /** Output paths of the source files with no code default; a file at one is left over from an earlier run. Empty when `errors` is not. */
  obsolete: string[];
  /** The errors of every source file, collected. */
  errors: ExtractError[];
}

/** What `check` found for a set of source files. */
export interface CheckResult {
  /** Output paths that are missing, left over or whose content differs from what would be generated. */
  stale: string[];
  /** The errors of every source file, collected. */
  errors: ExtractError[];
}

/**
 * Reads the `@default`/`@defaultValue` tags of one source file's top-level interfaces and object-type aliases.
 * A code span, a fence, or bare text that parses as an expression yields a member.
 * Bare prose and a default of exactly `undefined` are skipped.
 *
 * Errors go in `errors`, never thrown:
 * - both tags, or one tag twice, on a member
 * - a code span or fence that is not one expression
 * - a generic or non-exported declaration
 * - a default that reads a local declaration
 * - a code tag in an unsupported location
 * - a malformed directive
 */
export function extractDefaults(
  sourceText: string,
  fileName: string,
): ExtractResult {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const result: ExtractResult = {
    members: [],
    imports: [],
    directives: [],
    errors: [],
  };
  const fail = (pos: number, message: string) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(pos);
    result.errors.push({
      file: fileName,
      line: line + 1,
      column: character + 1,
      message,
    });
  };
  const scope = scopeOf(sf, fail);
  result.directives = scope.directives;
  const members = taggedMembers(sf);
  const handled = new Set(members.flatMap(({ tags }) => tags));
  for (const tag of strayCodeTags(sf, handled))
    fail(
      tag.getStart(sf),
      'unsupported location for a default tag: only direct members of top-level interfaces and object-type aliases',
    );
  const exported = exportedNames(sf);
  for (const {
    decl,
    member,
    tags: [node, extra],
  } of members) {
    const name = decl.name.text;
    const key = member.name.getText(sf);
    const at = (n: ts.Node, message: string) =>
      fail(n.getStart(sf), `${name}.${key}: ${message}`);
    // Merged declarations of one name may repeat a member.
    const repeated = result.members.some(
      (m) => m.declaration === name && m.member === key,
    );
    if (extra || repeated) {
      at(
        extra ?? node,
        'has both @default and @defaultValue (or one twice); keep one',
      );
      continue;
    }
    const tag = parseDefault(classifyTag(tagText(node)), scope.known);
    if (tag.kind === 'prose') continue;
    if (tag.kind === 'error') {
      at(node, tag.message);
      continue;
    }
    for (const id of tag.ids)
      if (!scope.imports.has(id) && scope.locals.has(id))
        at(
          node,
          `\`${id}\` cannot reference a local declaration from a default; export it from another module or make it ambient`,
        );
    for (const statement of tag.ids.flatMap(
      (id) => scope.imports.get(id) ?? [],
    ))
      if (!result.imports.includes(statement)) result.imports.push(statement);
    result.members.push({
      declaration: name,
      member: key,
      expression: tag.expression,
    });
  }
  // `undefined` means "no default": nothing to apply, and `Required<Pick<…>>` would reject it.
  result.members = result.members.filter((m) => m.expression !== 'undefined');
  for (const name of new Set(result.members.map((m) => m.declaration))) {
    const { decl } = members.find((m) => m.decl.name.text === name)!;
    const problem = declProblem(decl, exported);
    if (problem) fail(decl.getStart(sf), `${name}: ${problem}`);
  }
  return result;
}

/** Names the file exports under their own name through `export { Name }` lists. */
function exportedNames(sf: ts.SourceFile): Set<string> {
  return new Set(
    sf.statements.flatMap((s) =>
      ts.isExportDeclaration(s) &&
      !s.moduleSpecifier &&
      s.exportClause &&
      ts.isNamedExports(s.exportClause)
        ? s.exportClause.elements
            .filter((el) => !el.propertyName)
            .map((el) => el.name.text)
        : [],
    ),
  );
}

/** Why the generated module cannot import a declaration's type, if it cannot. */
function declProblem(decl: Decl, exported: Set<string>): string | undefined {
  if (decl.typeParameters?.length)
    return 'generic declarations are not supported';
  const mods = ts.getCombinedModifierFlags(decl);
  const isExport = (mods & ts.ModifierFlags.Export) !== 0;
  const isDefault = (mods & ts.ModifierFlags.Default) !== 0;
  if ((isExport && !isDefault) || (!isExport && exported.has(decl.name.text)))
    return undefined;
  return 'not exported; export it so the generated module can import its type';
}

/** Formats an error as `file:line:col message`. */
export const formatError = (e: ExtractError) =>
  `${e.file}:${e.line}:${e.column} ${e.message}`;

/**
 * The generated module's path next to its source: `.ts`, `.tsx` and `.d.ts` give `<name>.defaults.ts`, `.mts` and
 * `.cts` keep their module flavour (`<name>.defaults.mts`, `.cts`); any other name gets `.defaults.ts` appended.
 */
export const outputPath = (source: string) =>
  source.replace(/(\.d)?\.([cm]?)tsx?$|$/, '.defaults.$2ts');

/** Whether a path is named like a generated module, see `outputPath`. */
export const isOutput = (file: string) => /\.defaults\.[cm]?ts$/.test(file);

function sourceSpecifier(source: string, importExt = ''): string {
  const [ext, flavour] = /\.([cm]?)tsx?$/.exec(source) ?? [''];
  // `./x` never resolves to `x.mts`; a module-flavoured source needs its runtime extension.
  const runtime = importExt || (flavour ? `.${flavour}js` : '');
  return `./${path.basename(source, ext)}${runtime}`;
}

const isStale = (out: string, text: string) =>
  !fs.existsSync(out) || !sameSyntax(fs.readFileSync(out, 'utf8'), text);

/**
 * Generates the module text for each source file, without writing anything.
 * A source with no code default gets no entry; its output path goes in `obsolete`.
 * If any source has errors, `files` and `obsolete` are empty. Throws if a source file cannot be read.
 */
export function generate(
  files: string[],
  options: GenerateOptions = {},
): GenerateResult {
  const errors: ExtractError[] = [];
  const out: GeneratedFile[] = [];
  const obsolete: string[] = [];
  for (const source of files) {
    const result = extractDefaults(fs.readFileSync(source, 'utf8'), source);
    errors.push(...result.errors);
    const output = outputPath(source);
    if (!result.members.length) {
      obsolete.push(output);
      continue;
    }
    const text = renderModule(
      path.basename(source),
      sourceSpecifier(source, options.importExt),
      result,
    );
    out.push({ source, output, text });
  }
  return errors.length
    ? { files: [], obsolete: [], errors }
    : { files: out, obsolete, errors };
}

/**
 * Regenerates each source file's module in memory and compares it with the file on disk, ignoring formatting
 * and comments. A missing file is stale, and so is one left over for a source that no longer has a code
 * default. Source files with errors are reported in `errors`, not in `stale`. Throws if a source file cannot
 * be read.
 */
export function check(
  files: string[],
  options: GenerateOptions = {},
): CheckResult {
  const result = generate(files, options);
  return {
    stale: [
      ...result.files
        .filter((f) => isStale(f.output, f.text))
        .map((f) => f.output),
      ...result.obsolete.filter((f) => fs.existsSync(f)),
    ],
    errors: result.errors,
  };
}
