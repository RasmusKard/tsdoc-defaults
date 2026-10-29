import { type Application, Comment, Converter, ReflectionKind } from 'typedoc';

import { KNOWN_GLOBALS, parseDefault } from './expressions.js';
import { classifyTag } from './tags.js';

/**
 * The expression a default tag holds, or undefined when the tag is prose.
 *
 * `text` is the tag content as TypeDoc renders it: one code span, one fence or bare text. A fence is read
 * as bare text, because TypeDoc itself wraps bare text in a fence before plugins see it: content that does
 * not parse as one expression is prose, never an error, and so is one that reads a name other than a known
 * global (`undefined`, `NaN`, `Infinity`, `globalThis`). A code span keeps the core's rule: any expression is code.
 */
export function defaultExpression(text: string): string | undefined {
  const tag = classifyTag(text);
  const parsed = parseDefault(
    tag.form === 'code' ? tag : { form: 'bare', text: tag.text },
    KNOWN_GLOBALS,
  );
  return parsed.kind === 'code' ? parsed.expression : undefined;
}

/**
 * TypeDoc plugin entry point, loaded by `{ "plugin": ["tsdoc-defaults/typedoc"] }` in `typedoc.json`.
 *
 * On every property whose `@default` or `@defaultValue` tag holds one expression, the expression text
 * becomes the reflection's `defaultValue` and the tag is removed from the comment; prose tags and all
 * other reflections are left as they are.
 */
export function load(app: Application): void {
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const r of context.project.getReflectionsByKind(
      ReflectionKind.Property,
    )) {
      // Not `instanceof`: with a linked install the plugin imports a different TypeDoc copy from the running one.
      if (!r.isDeclaration() || !r.comment) continue;
      const tag = r.comment.blockTags.find(
        (t) => t.tag === '@default' || t.tag === '@defaultValue',
      );
      if (!tag) continue;
      const expr = defaultExpression(
        Comment.combineDisplayParts(tag.content).trim(),
      );
      if (expr === undefined) continue;
      r.defaultValue = expr;
      r.comment.removeTags(tag.tag);
    }
  });
}
