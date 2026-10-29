import ts from 'typescript';

// Markdown code span: a run of backticks, content without that run, one padding space each side stripped.
const INLINE = /^(`+)(.+)\1$/s;
const FENCED = /^```[^\n]*\n([\s\S]*?)\n```$/;

export type Decl = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;
export type TagForm = 'code' | 'fence' | 'bare';
/** A default tag's form and the text that may be its expression. */
export type ClassifiedTag = { form: TagForm; text: string };

export const defaultTags = (node: ts.Node) =>
  ts
    .getJSDocTags(node)
    .filter(
      (t) => t.tagName.text === 'default' || t.tagName.text === 'defaultValue',
    );

// CRLF sources keep `\r` inside a fence; the generated file is LF only.
export const tagText = (tag: ts.JSDocTag) =>
  (ts.getTextOfJSDocComment(tag.comment) ?? '').replace(/\r\n?/g, '\n').trim();

/** Classifies a tag's text as one code span, one fence (any info string) or bare text, and strips the delimiters. */
export function classifyTag(text: string): ClassifiedTag {
  const fence = FENCED.exec(text);
  if (fence) return { form: 'fence', text: fence[1] };
  const code = INLINE.exec(text);
  if (code && !code[2].includes(code[1]))
    return { form: 'code', text: code[2].replace(/^ (.+) $/s, '$1') };
  return { form: 'bare', text };
}

/** Direct, non-computed property members of top-level interfaces and object-literal type aliases that carry a default tag, in source order. */
export function taggedMembers(sf: ts.SourceFile): {
  decl: Decl;
  member: ts.PropertySignature;
  tags: ts.JSDocTag[];
}[] {
  return sf.statements.flatMap((s) => {
    const members: readonly ts.TypeElement[] = ts.isInterfaceDeclaration(s)
      ? s.members
      : ts.isTypeAliasDeclaration(s) && ts.isTypeLiteralNode(s.type)
        ? s.type.members
        : [];
    return members
      .filter(
        (m): m is ts.PropertySignature =>
          ts.isPropertySignature(m) && !ts.isComputedPropertyName(m.name),
      )
      .map((member) => ({ decl: s as Decl, member, tags: defaultTags(member) }))
      .filter(({ tags }) => tags.length);
  });
}

/** Default tags written as a code span or fence on any node except the handled members. */
export function strayCodeTags(
  sf: ts.SourceFile,
  handled: Set<ts.JSDocTag>,
): Set<ts.JSDocTag> {
  const found = new Set<ts.JSDocTag>(); // a Set: a variable's tags are returned for both its statement and declaration
  const visit = (n: ts.Node): void => {
    for (const tag of defaultTags(n))
      if (!handled.has(tag) && classifyTag(tagText(tag)).form !== 'bare')
        found.add(tag);
    n.forEachChild(visit);
  };
  visit(sf);
  return found;
}
