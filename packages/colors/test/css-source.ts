/**
 * TypeScript owns literals/comments; PostCSS owns CSS rules/declarations;
 * CSS Tree owns CSS tokens, selectors and media conditions.
 * This reads authored styles, not arbitrary JS execution or the DOM cascade.
 * https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
 * https://github.com/csstree/csstree/blob/master/docs/parsing.md
 * https://postcss.org/api/
 */
import * as css from 'css-tree';
import postcss, { type ChildNode, type Root } from 'postcss';
import ts from 'typescript';
import { staticCssValues, unknownValue } from './static-css-values.js';

interface Span {
  readonly start: number;
  readonly end: number;
}

function blankSpans(source: string, spans: readonly Span[]): string {
  const chars = source.split('');
  for (const { start, end } of spans) {
    for (let i = start; i < end; i++) {
      if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
    }
  }
  return chars.join('');
}

function sourceFile(source: string): ts.SourceFile {
  return ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Literal ranges include each template fragment, even in nested templates. */
function literalSpans(file: ts.SourceFile): Span[] {
  const spans: Span[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateLiteralToken(node) ||
      ts.isRegularExpressionLiteral(node)
    ) {
      spans.push({ start: node.getStart(file), end: node.end });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return spans;
}

interface CssText extends Span {
  readonly text: string;
  readonly cooked?: string;
  readonly complete: boolean;
  readonly completeValue: boolean;
  readonly rendered?: string;
  readonly sourceOffset?: (offset: number, end?: boolean) => number;
  readonly unknownHoles?: readonly Span[];
}

/** Raw text serves comment scanning. Authored profiles and pure local formatters
 * can resolve template holes; unknown code never grants a syntax proof. */
function literalCss(file: ts.SourceFile, groupComments = true): CssText[] {
  const texts: CssText[] = [];
  const values = staticCssValues(file);
  const arrays = new Set<ts.ArrayLiteralExpression>();
  const variables = new Map<string, ts.ArrayLiteralExpression>();
  const scopeKey = (node: ts.Node, name: string): string => {
    let scope = node.parent;
    while (scope && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
    return `${scope?.pos}:${name}`;
  };
  const findArrays = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      variables.set(scopeKey(node, node.name.text), node.initializer);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'join' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0] as ts.Node)
    ) {
      const receiver = node.expression.expression;
      const array = ts.isArrayLiteralExpression(receiver)
        ? receiver
        : ts.isIdentifier(receiver)
          ? variables.get(scopeKey(node, receiver.text))
          : undefined;
      if (array) arrays.add(array);
    }
    ts.forEachChild(node, findArrays);
  };
  findArrays(file);
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      const start = node.getStart(file) + 1;
      const end = node.end - 1;
      let text = file.text.slice(start, end);
      let rendered: string | undefined;
      let sourceOffset: CssText['sourceOffset'];
      const unknownHoles: Span[] = [];
      if (ts.isTemplateExpression(node)) {
        let previous: ts.TemplateLiteralToken = node.head;
        const holes: Span[] = [];
        const replacements: { hole: Span; value: string }[] = [];
        for (const span of node.templateSpans) {
          const hole = {
            start: previous.end - 2 - start,
            end: span.literal.getStart(file) + 1 - start,
          };
          holes.push(hole);
          const value = values.evaluate(span.expression);
          const known =
            value !== unknownValue && (typeof value === 'string' || typeof value === 'number');
          if (!known) unknownHoles.push({ start: start + hole.start, end: start + hole.end });
          replacements.push({
            hole,
            value: known
              ? String(value)
              : text.slice(hole.start, hole.end).replace(/[^\n\r]/g, ' '),
          });
          previous = span.literal;
        }
        let cursor = 0;
        rendered = '';
        const mapping: { from: number; to: number; hole: Span }[] = [];
        for (const replacement of replacements) {
          rendered += text.slice(cursor, replacement.hole.start);
          const from = rendered.length;
          rendered += replacement.value;
          mapping.push({ from, to: rendered.length, hole: replacement.hole });
          cursor = replacement.hole.end;
        }
        rendered += text.slice(cursor);
        sourceOffset = (offset, end = false) => {
          let delta = 0;
          for (const item of mapping) {
            if (offset < item.from) break;
            if (offset < item.to) return end ? item.hole.end : item.hole.start;
            delta += item.hole.end - item.hole.start - (item.to - item.from);
          }
          return offset + delta;
        };
        text = blankSpans(text, holes);
      }
      // Plain labels/import paths cannot grant a CSS exception.
      const rawTag =
        ts.isTaggedTemplateExpression(node.parent) &&
        ts.isPropertyAccessExpression(node.parent.tag) &&
        ts.isIdentifier(node.parent.tag.expression) &&
        node.parent.tag.expression.text === 'String' &&
        node.parent.tag.name.text === 'raw';
      texts.push({
        text,
        start,
        end,
        complete: unknownHoles.length === 0,
        completeValue: unknownHoles.length === 0,
        rendered,
        sourceOffset,
        unknownHoles,
        cooked: ts.isStringLiteralLike(node) && !rawTag ? node.text : undefined,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!groupComments) return texts.filter(({ text }) => /[{}:;]|\/\*/.test(text));
  // Generators also emit arrays of CSS lines with join(). Preserve that one
  // composition boundary so a block comment may span several literal elements.
  const grouped: CssText[] = [];
  for (const array of arrays) {
    const start = array.getStart(file);
    const end = array.end;
    const parts = texts.filter((text) =>
      array.elements.some((element) => text.start === element.getStart(file) + 1),
    );
    let text = file.text.slice(start, end).replace(/[^\r\n]/g, ' ');
    for (const part of parts)
      text = text.slice(0, part.start - start) + part.text + text.slice(part.end - start);
    grouped.push({ start, end, text, complete: false, completeValue: false });
  }
  return [
    ...grouped,
    ...texts.filter(
      (text) => !grouped.some((group) => text.start >= group.start && text.end <= group.end),
    ),
  ].filter(({ text }) => /[{}:;]|\/\*/.test(text));
}

function cssComments(text: string, offset = 0): Span[] {
  const spans: Span[] = [];
  css.tokenize(text, (type, start, end) => {
    if (type === css.tokenTypes.Comment) spans.push({ start: start + offset, end: end + offset });
  });
  return spans;
}

/** Blank actual comments, never URL/string content; preserve source offsets. */
export function stripComments(source: string, isTs: boolean): string {
  if (!isTs) return blankSpans(source, cssComments(source));
  const file = sourceFile(source);
  // Mask AST literal tokens before lexing trivia. Closing interpolation braces
  // then cannot change scanner mode or expose a template's https:// as a comment.
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    blankSpans(source, literalSpans(file)),
  );
  const comments: Span[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      comments.push({ start: scanner.getTokenPos(), end: scanner.getTextPos() });
    }
  }
  for (const literal of literalCss(file))
    comments.push(...cssComments(literal.text, literal.start));
  return blankSpans(source, comments);
}

export interface CssCondition {
  readonly key: string;
  readonly forcedColours: boolean;
}

export interface CssDeclaration extends Span {
  readonly property: string;
  readonly value: string;
  readonly important: boolean;
  /** One array of atomic selector nodes per selector-list member. */
  readonly selectors: readonly (readonly string[])[];
  readonly conditions: readonly CssCondition[];
  readonly document: number;
  /** The complete stylesheet is known, including resolved profile interpolation. */
  readonly complete: boolean;
  /** This declaration's property/value is resolved even if other rules are dynamic. */
  readonly completeValue: boolean;
}

export interface CssSource {
  readonly text: string;
  readonly declarations: readonly CssDeclaration[];
  readonly sourceIndex: (index: number) => number;
}

/** A sufficient proof, not media-query evaluation: unknown branches stay false. */
function forcesColours(node: css.CssNode): boolean {
  if (node.type === 'Feature') {
    return (
      node.name.toLowerCase() === 'forced-colors' &&
      node.value?.type === 'Identifier' &&
      node.value.name.toLowerCase() === 'active'
    );
  }
  if (node.type === 'MediaQuery')
    return node.modifier !== 'not' && node.condition !== null && forcesColours(node.condition);
  if (node.type === 'MediaQueryList')
    return !node.children.isEmpty && node.children.toArray().every(forcesColours);
  if (node.type === 'AtrulePrelude') return node.children.toArray().some(forcesColours);
  if (node.type !== 'Condition') return false;
  const parts = node.children.toArray();
  if (parts.some((part) => part.type === 'Identifier' && part.name.toLowerCase() === 'not'))
    return false;
  const terms = parts.filter((part) => part.type !== 'Identifier');
  const or = parts.some((part) => part.type === 'Identifier' && part.name.toLowerCase() === 'or');
  return terms.length > 0 && (or ? terms.every(forcesColours) : terms.some(forcesColours));
}

function resolvedSelectors(source: string, parents: readonly (readonly string[])[]): string[][] {
  let parsed: css.CssNode;
  try {
    parsed = css.parse(source, { context: 'selectorList' });
  } catch {
    return [];
  }
  if (parsed.type !== 'SelectorList') return [];
  const selectors: string[][] = [];
  for (const selector of parsed.children) {
    if (selector.type !== 'Selector') continue;
    const atoms = selector.children
      .toArray()
      .map((node) => (node.type === 'Combinator' ? node.name : css.generate(node)));
    if (parents.length === 0) {
      if (!atoms.includes('&')) selectors.push(atoms);
      continue;
    }
    for (const parent of parents) {
      if (atoms.includes('&'))
        selectors.push(atoms.flatMap((atom) => (atom === '&' ? [...parent] : [atom])));
      else
        selectors.push([
          ...parent,
          ...(atoms[0] === '>' || atoms[0] === '+' || atoms[0] === '~' ? [] : [' ']),
          ...atoms,
        ]);
    }
  }
  return selectors;
}

/**
 * Inspect every fragment, but allow cascade exceptions only in fully resolved CSS.
 * A forced-palette condition additionally proves its own complete enclosing block.
 * Cooked literal text comes from TypeScript; String.raw keeps its raw spelling.
 * No decoder/source map is maintained: changed literals report their start.
 */
export function analyzeCssSource(source: string, isTs: boolean): CssSource {
  const texts = isTs
    ? literalCss(sourceFile(source), false)
    : [{ text: source, start: 0, end: source.length, complete: true, completeValue: true }];
  // Small scanner probes can also supply a bare CSS fragment with a TS filename.
  if (texts.length === 0)
    texts.push({
      text: source,
      start: 0,
      end: source.length,
      complete: !isTs,
      completeValue: !isTs,
    });
  const out: CssDeclaration[] = [];
  let text = source;
  const changed: Span[] = [];
  for (const [document, input] of texts.entries()) {
    const rendered = input.rendered ?? input.cooked ?? input.text;
    const cssText = blankSpans(rendered, cssComments(rendered));
    if (input.cooked !== undefined && cssText !== input.text) {
      text =
        text.slice(0, input.start) +
        cssText.padEnd(input.end - input.start) +
        text.slice(input.end);
      changed.push(input);
    }
    let root: Root;
    try {
      root = postcss.parse(cssText);
    } catch {
      continue; // An unparseable document cannot grant an exception.
    }
    const visit = (
      node: Root | ChildNode,
      selectors: readonly (readonly string[])[],
      conditions: readonly CssCondition[],
    ): void => {
      if (node.type === 'decl') {
        if (node.source?.start?.offset === undefined || node.source.end?.offset === undefined)
          return;
        const start =
          input.start +
          (input.sourceOffset?.(node.source.start.offset) ?? node.source.start.offset);
        const end =
          input.start +
          (input.sourceOffset?.(node.source.end.offset + 1, true) ?? node.source.end.offset + 1);
        out.push({
          start,
          end,
          property: node.prop.toLowerCase(),
          value: node.value.trim(),
          important: !!node.important,
          selectors,
          conditions,
          document,
          complete: input.complete,
          completeValue:
            input.complete ||
            !input.unknownHoles?.some((hole) => hole.start < end && hole.end > start),
        });
      } else if (node.type === 'rule') {
        const resolved = resolvedSelectors(node.selector, selectors);
        for (const child of node.nodes) visit(child, resolved, conditions);
      } else if (node.type === 'atrule' && node.nodes) {
        let forcedColours = false;
        let params = node.params;
        if (node.name.toLowerCase() === 'media') {
          try {
            const query = css.parse(params, { context: 'mediaQueryList' });
            const from =
              input.start +
              (input.sourceOffset?.(node.source?.start?.offset ?? 0) ??
                node.source?.start?.offset ??
                0);
            const to =
              input.start +
              (input.sourceOffset?.((node.source?.end?.offset ?? rendered.length) + 1, true) ??
                (node.source?.end?.offset ?? rendered.length) + 1);
            forcedColours =
              forcesColours(query) &&
              !input.unknownHoles?.some((hole) => hole.start < to && hole.end > from);
            params = css.generate(query);
          } catch {
            /* Unknown conditions cannot grant exceptions. */
          }
        }
        const nested = [
          ...conditions,
          { key: `@${node.name.toLowerCase()} ${params}`, forcedColours },
        ];
        for (const child of node.nodes) visit(child, selectors, nested);
      } else if (node.type === 'root') {
        for (const child of node.nodes) visit(child, selectors, conditions);
      }
    };
    visit(root, [], []);
  }
  return {
    text,
    declarations: out,
    sourceIndex: (index) =>
      changed.find((span) => index >= span.start && index < span.end)?.start ?? index,
  };
}

/** Both string and url() forms are CSS import syntax, with optional conditions. */
export function cssImports(source: string): string[] {
  const imports: string[] = [];
  css.walk(css.parse(source), {
    visit: 'Atrule',
    enter(node) {
      if (node.name.toLowerCase() !== 'import' || node.prelude?.type !== 'AtrulePrelude') return;
      const path = node.prelude.children.first;
      if (path?.type === 'String' || path?.type === 'Url') imports.push(path.value);
    },
  });
  return imports;
}

/** Type annotations and property names are never runtime channel inputs. */
export function readsRuntimeData(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return !['NaN', 'Infinity', 'undefined'].includes(node.text);
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node)
  )
    return readsRuntimeData(node.expression);
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    return readsRuntimeData(node.expression);
  if (ts.isCallExpression(node)) return node.arguments.some(readsRuntimeData);
  if (ts.isBinaryExpression(node))
    return readsRuntimeData(node.left) || readsRuntimeData(node.right);
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
    return readsRuntimeData(node.operand);
  if (ts.isConditionalExpression(node))
    return readsRuntimeData(node.whenTrue) && readsRuntimeData(node.whenFalse);
  return false;
}
