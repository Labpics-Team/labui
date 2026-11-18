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
}

/** Keep raw-source offsets; unknown interpolation cannot establish a proof. */
function literalCss(file: ts.SourceFile): CssText[] {
  const texts: CssText[] = [];
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
      if (ts.isTemplateExpression(node)) {
        let previous: ts.TemplateLiteralToken = node.head;
        const holes: Span[] = [];
        for (const span of node.templateSpans) {
          holes.push({
            start: previous.end - 2 - start,
            end: span.literal.getStart(file) + 1 - start,
          });
          previous = span.literal;
        }
        text = blankSpans(text, holes);
      }
      // Plain labels/import paths cannot grant a CSS exception.
      texts.push({ text, start, end });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
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
    grouped.push({ start, end, text });
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

/** Read declarations only; nested declarations retain enclosing conditions. */
export function cssDeclarations(source: string, isTs: boolean): CssDeclaration[] {
  const texts = isTs
    ? literalCss(sourceFile(source))
    : [{ text: source, start: 0, end: source.length }];
  // Small scanner probes can also supply a bare CSS fragment with a TS filename.
  if (texts.length === 0) texts.push({ text: source, start: 0, end: source.length });
  const out: CssDeclaration[] = [];
  for (const [document, input] of texts.entries()) {
    let root: Root;
    try {
      root = postcss.parse(input.text);
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
        out.push({
          start: input.start + node.source.start.offset,
          end: input.start + node.source.end.offset + 1,
          property: node.prop.toLowerCase(),
          value: node.value.trim(),
          important: !!node.important,
          selectors,
          conditions,
          document,
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
            forcedColours = forcesColours(query);
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
  return out;
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
