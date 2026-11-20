import ts from 'typescript';
import components from '../../tokens/src/components.js';

export const unknownValue = Symbol('unknown static CSS value');
type Scope = ReadonlyMap<string, unknown>;
interface FunctionValue {
  readonly expression: ts.ArrowFunction;
  readonly scope: Scope;
}
function isFunctionValue(value: unknown): value is FunctionValue {
  if (!value || typeof value !== 'object' || !('expression' in value) || !('scope' in value))
    return false;
  return (
    !!value.expression &&
    typeof value.expression === 'object' &&
    'kind' in value.expression &&
    value.expression.kind === ts.SyntaxKind.ArrowFunction &&
    value.scope instanceof Map
  );
}

/** A deliberately small evaluator for authored data and pure formatters.
 * It never imports component code, executes JS, or assumes an unknown call is safe.
 * TypeScript owns syntax; unsupported expressions remain unknown.
 */
export function staticCssValues(file: ts.SourceFile) {
  const initial = new Map<string, unknown>();
  const definitions = new Map<string, ts.Expression>();
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@labpics/ui-tokens'
    ) {
      const imports = statement.importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports))
        for (const entry of imports.elements) {
          const name = entry.propertyName?.text ?? entry.name.text;
          const profile = Object.entries(components).find(
            ([key]) =>
              `${key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}Profile` ===
              name,
          );
          if (profile) initial.set(entry.name.text, profile[1]);
        }
    }
    if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const)
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer)
          definitions.set(declaration.name.text, declaration.initializer);
  }
  const profileNames = new Set(initial.keys());
  const invalidateWrites = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      let root = node.left;
      while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root))
        root = root.expression;
      if (ts.isIdentifier(root)) {
        initial.delete(root.text);
        definitions.delete(root.text);
        profileNames.delete(root.text);
      }
    }
    ts.forEachChild(node, invalidateWrites);
  };
  invalidateWrites(file);
  const bind = (name: ts.BindingName, value: unknown, scope: Map<string, unknown>): void => {
    if (ts.isIdentifier(name)) scope.set(name.text, value);
    else if (ts.isArrayBindingPattern(name) && Array.isArray(value))
      name.elements.forEach((entry, index) => {
        if (ts.isBindingElement(entry)) bind(entry.name, value[index], scope);
      });
  };
  const run = (fn: FunctionValue, args: unknown[], depth: number): unknown => {
    const scope = new Map(fn.scope);
    for (const [index, parameter] of fn.expression.parameters.entries())
      bind(
        parameter.name,
        args[index] ??
          (parameter.initializer
            ? evaluate(parameter.initializer, scope, depth + 1)
            : unknownValue),
        scope,
      );
    return ts.isBlock(fn.expression.body)
      ? unknownValue
      : evaluate(fn.expression.body, scope, depth + 1);
  };
  const evaluate = (node: ts.Expression, scope: Scope = initial, depth = 0): unknown => {
    if (depth > 40) return unknownValue;
    const next = (value: ts.Expression) => evaluate(value, scope, depth + 1);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return next(node.expression);
    if (ts.isIdentifier(node)) {
      if (scope.has(node.text)) return scope.get(node.text);
      const definition = definitions.get(node.text);
      return definition ? evaluate(definition, initial, depth + 1) : unknownValue;
    }
    if (ts.isArrowFunction(node)) return { expression: node, scope } satisfies FunctionValue;
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) {
        const part = next(span.expression);
        if (typeof part !== 'string' && typeof part !== 'number') return unknownValue;
        value += String(part) + span.literal.text;
      }
      return value;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const values = node.elements.map((element) =>
        ts.isSpreadElement(element) ? unknownValue : next(element),
      );
      return values.includes(unknownValue) ? unknownValue : values;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
        )
          return unknownValue;
        const value = next(property.initializer);
        if (value === unknownValue) return unknownValue;
        result[property.name.text] = value;
      }
      return result;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const object = next(node.expression);
      const key = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : next(node.argumentExpression);
      return object !== null &&
        typeof object === 'object' &&
        (typeof key === 'string' || typeof key === 'number') &&
        Object.hasOwn(object, key)
        ? (object as Record<string | number, unknown>)[key]
        : unknownValue;
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const value = next(node.operand);
      if (typeof value !== 'number') return unknownValue;
      return node.operator === ts.SyntaxKind.MinusToken
        ? -value
        : node.operator === ts.SyntaxKind.PlusToken
          ? value
          : unknownValue;
    }
    if (ts.isBinaryExpression(node)) {
      const left = next(node.left);
      const right = next(node.right);
      if (typeof left !== 'number' || typeof right !== 'number') return unknownValue;
      switch (node.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken:
          return left + right;
        case ts.SyntaxKind.MinusToken:
          return left - right;
        case ts.SyntaxKind.AsteriskToken:
          return left * right;
        case ts.SyntaxKind.SlashToken:
          return left / right;
        default:
          return unknownValue;
      }
    }
    if (ts.isCallExpression(node)) {
      const args = node.arguments.map(next);
      if (args.includes(unknownValue)) return unknownValue;
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'encodeURIComponent' &&
        !definitions.has('encodeURIComponent') &&
        !scope.has('encodeURIComponent') &&
        typeof args[0] === 'string'
      )
        return encodeURIComponent(args[0]);
      if (ts.isPropertyAccessExpression(node.expression)) {
        const member = node.expression;
        if (
          ts.isIdentifier(member.expression) &&
          member.expression.text === 'Object' &&
          member.name.text === 'entries' &&
          !definitions.has('Object') &&
          !scope.has('Object') &&
          args[0] !== null &&
          typeof args[0] === 'object'
        )
          return Object.entries(args[0]);
        if (
          ts.isIdentifier(member.expression) &&
          member.expression.text === 'Array' &&
          member.name.text === 'from' &&
          !definitions.has('Array') &&
          !scope.has('Array') &&
          args[0] &&
          typeof args[0] === 'object' &&
          'length' in args[0] &&
          typeof args[0].length === 'number' &&
          Number.isInteger(args[0].length) &&
          args[0].length >= 0 &&
          args[0].length <= 256 &&
          isFunctionValue(args[1])
        ) {
          const result = Array.from({ length: args[0].length }, (_, index) =>
            run(args[1] as FunctionValue, [undefined, index], depth + 1),
          );
          return result.includes(unknownValue) ? unknownValue : result;
        }
        const receiver = next(member.expression);
        if (Array.isArray(receiver)) {
          if (
            member.name.text === 'join' &&
            args.length <= 1 &&
            (args.length === 0 || typeof args[0] === 'string') &&
            receiver.every((value) => typeof value === 'string' || typeof value === 'number')
          )
            return receiver.join(args[0] as string | undefined);
          if (member.name.text === 'map' && isFunctionValue(args[0])) {
            const result = receiver.map((value, index) =>
              run(args[0] as FunctionValue, [value, index], depth + 1),
            );
            return result.includes(unknownValue) ? unknownValue : result;
          }
        }
      }
      const fn = next(node.expression);
      if (isFunctionValue(fn)) return run(fn, args, depth + 1);
    }
    return unknownValue;
  };
  const isProfileNumber = (
    node: ts.Expression,
    argumentsByName = new Map<string, ts.Expression>(),
  ): boolean => {
    if (ts.isIdentifier(node) && argumentsByName.has(node.text))
      return isProfileNumber(argumentsByName.get(node.text) as ts.Expression);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
      return isProfileNumber(node.expression, argumentsByName);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      let root: ts.Expression = node;
      while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root))
        root = root.expression;
      return (
        ts.isIdentifier(root) && profileNames.has(root.text) && typeof evaluate(node) === 'number'
      );
    }
    if (ts.isBinaryExpression(node))
      return (
        isProfileNumber(node.left, argumentsByName) || isProfileNumber(node.right, argumentsByName)
      );
    return ts.isPrefixUnaryExpression(node) && isProfileNumber(node.operand, argumentsByName);
  };
  const isProfileInterpolation = (node: ts.Expression): boolean => {
    if (typeof evaluate(node) === 'number') return isProfileNumber(node);
    if (!ts.isCallExpression(node)) return false;
    const fn = evaluate(node.expression);
    if (!isFunctionValue(fn)) return false;
    const body = fn.expression.body;
    if (
      !ts.isTemplateExpression(body) ||
      body.head.text !== '' ||
      body.templateSpans.length !== 1 ||
      !/^(?:px|rem|em)$/.test(body.templateSpans[0]?.literal.text ?? '')
    )
      return false;
    const args = new Map<string, ts.Expression>();
    fn.expression.parameters.forEach((parameter, index) => {
      if (ts.isIdentifier(parameter.name) && node.arguments[index])
        args.set(parameter.name.text, node.arguments[index] as ts.Expression);
    });
    return isProfileNumber(body.templateSpans[0]?.expression as ts.Expression, args);
  };
  return { evaluate, isProfileInterpolation };
}
