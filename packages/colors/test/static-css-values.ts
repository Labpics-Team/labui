import ts from 'typescript';
import components from '../../tokens/src/components.js';

export const unknownValue = Symbol('unknown static CSS value');
type Scope = ReadonlyMap<ts.Symbol, unknown>;
interface FunctionValue {
  readonly expression: ts.ArrowFunction;
  readonly scope: Scope;
}
function isTransparentExpression(
  node: ts.Node,
): node is
  | ts.ParenthesizedExpression
  | ts.AsExpression
  | ts.NonNullExpression
  | ts.SatisfiesExpression {
  return (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  );
}

function rootExpression(expression: ts.Expression): ts.Expression {
  let root = expression;
  while (
    ts.isPropertyAccessExpression(root) ||
    ts.isElementAccessExpression(root) ||
    isTransparentExpression(root)
  )
    root = root.expression;
  return root;
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
  // Let TypeScript bind declarations, parameters and block scopes. No imports,
  // libraries, filesystem access or type diagnostics are needed for this proof.
  const checker = ts
    .createProgram(
      [file.fileName],
      { noLib: true, noResolve: true },
      {
        getSourceFile: (name) => (name === file.fileName ? file : undefined),
        getDefaultLibFileName: () => '',
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: (name) => name === file.fileName,
        readFile: (name) => (name === file.fileName ? file.text : undefined),
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
      },
    )
    .getTypeChecker();
  const symbolAt = (node: ts.Node) =>
    ts.isExportSpecifier(node.parent)
      ? checker.getExportSpecifierLocalTargetSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
  const initial = new Map<ts.Symbol, unknown>();
  const definitions = new Map<ts.Symbol, ts.Expression>();
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
          const symbol = symbolAt(entry.name);
          if (profile && symbol) initial.set(symbol, profile[1]);
        }
    }
    if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const)
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          const symbol = symbolAt(declaration.name);
          if (symbol) definitions.set(symbol, declaration.initializer);
        }
  }
  const profiles = new Set(initial.keys());
  const invalid = new Set<ts.Symbol>();
  const writtenGlobals = new Set<string>();
  const rootSymbol = (expression: ts.Expression): ts.Symbol | undefined => {
    const root = rootExpression(expression);
    return ts.isIdentifier(root) ? symbolAt(root) : undefined;
  };
  const invalidateTarget = (target: ts.Node): void => {
    if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (ts.isPropertyAssignment(property)) invalidateTarget(property.initializer);
        else if (ts.isShorthandPropertyAssignment(property)) invalidateTarget(property.name);
        else if (ts.isSpreadAssignment(property)) invalidateTarget(property.expression);
      }
    } else if (ts.isArrayLiteralExpression(target)) {
      for (const element of target.elements) invalidateTarget(element);
    } else if (ts.isSpreadElement(target)) invalidateTarget(target.expression);
    else if (ts.isBinaryExpression(target)) invalidateTarget(target.left);
    else if (isTransparentExpression(target)) invalidateTarget(target.expression);
    else if (
      ts.isIdentifier(target) ||
      ts.isPropertyAccessExpression(target) ||
      ts.isElementAccessExpression(target)
    ) {
      const symbol = rootSymbol(target);
      if (symbol) invalid.add(symbol);
      else {
        const root = rootExpression(target);
        if (ts.isIdentifier(root)) writtenGlobals.add(root.text);
      }
    }
  };
  const invalidateWrites = (node: ts.Node): void => {
    const target =
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        ? node.left
        : (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken ||
              node.operator === ts.SyntaxKind.MinusMinusToken)
          ? node.operand
          : ts.isDeleteExpression(node)
            ? node.expression
            : undefined;
    if (target) invalidateTarget(target);
    ts.forEachChild(node, invalidateWrites);
  };
  invalidateWrites(file);
  const bind = (name: ts.BindingName, value: unknown, scope: Map<ts.Symbol, unknown>): boolean => {
    if (ts.isIdentifier(name)) {
      const symbol = symbolAt(name);
      if (symbol) scope.set(symbol, value);
      return !!symbol;
    }
    if (ts.isArrayBindingPattern(name) && Array.isArray(value))
      return name.elements.every((entry, index) => {
        if (!ts.isBindingElement(entry)) return true;
        // Destructuring defaults/rest need further execution semantics. Leave
        // the whole call unknown instead of silently skipping those effects.
        return !entry.initializer && !entry.dotDotDotToken && bind(entry.name, value[index], scope);
      });
    return false;
  };
  const run = (fn: FunctionValue, args: unknown[], depth: number): unknown => {
    const scope = new Map(fn.scope);
    for (const [index, parameter] of fn.expression.parameters.entries()) {
      if (parameter.dotDotDotToken) return unknownValue;
      let value = args[index];
      if (value === undefined && parameter.initializer) {
        value = evaluate(parameter.initializer, scope, depth + 1);
        if (value === unknownValue) return unknownValue;
      }
      if (!bind(parameter.name, value, scope)) return unknownValue;
    }
    return ts.isBlock(fn.expression.body)
      ? unknownValue
      : evaluate(fn.expression.body, scope, depth + 1);
  };
  const evaluate = (node: ts.Expression, scope: Scope = initial, depth = 0): unknown => {
    if (depth > 40) return unknownValue;
    const next = (value: ts.Expression) => evaluate(value, scope, depth + 1);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (isTransparentExpression(node)) return next(node.expression);
    if (ts.isIdentifier(node)) {
      const symbol = symbolAt(node);
      if (!symbol || invalid.has(symbol)) return unknownValue;
      if (scope.has(symbol)) return scope.get(symbol);
      const definition = definitions.get(symbol);
      const value = definition ? evaluate(definition, initial, depth + 1) : unknownValue;
      // A const object is still mutable. Do not infer its identity, alias graph
      // or effect history. Only imported authored profiles and callback inputs
      // carry object values; local consts may provide primitives or formatters.
      return value !== null && typeof value === 'object' && !isFunctionValue(value)
        ? unknownValue
        : value;
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
        !symbolAt(node.expression) &&
        !writtenGlobals.has('encodeURIComponent') &&
        typeof args[0] === 'string'
      )
        return encodeURIComponent(args[0]);
      if (ts.isPropertyAccessExpression(node.expression)) {
        const member = node.expression;
        if (
          ts.isIdentifier(member.expression) &&
          member.expression.text === 'Object' &&
          member.name.text === 'entries' &&
          !symbolAt(member.expression) &&
          !writtenGlobals.has('Object') &&
          args[0] !== null &&
          typeof args[0] === 'object'
        )
          return Object.entries(args[0]);
        if (
          ts.isIdentifier(member.expression) &&
          member.expression.text === 'Array' &&
          member.name.text === 'from' &&
          !symbolAt(member.expression) &&
          !writtenGlobals.has('Array') &&
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

  // A profile may be read as primitive fields, or consumed immediately by a
  // fully understood pure expression (entries/map/join). Any object alias,
  // export or unknown call can expose mutable data, so revoke that profile.
  const inspectProfileReferences = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const symbol = symbolAt(node);
      if (symbol && profiles.has(symbol) && !ts.isImportSpecifier(node.parent)) {
        let expression: ts.Expression = node;
        while (
          (ts.isPropertyAccessExpression(expression.parent) ||
            ts.isElementAccessExpression(expression.parent) ||
            isTransparentExpression(expression.parent)) &&
          expression.parent.expression === expression
        )
          expression = expression.parent;
        const value = evaluate(expression);
        if ((value !== null && typeof value === 'object') || value === unknownValue) {
          // Widen only through call/member chains, never through declarations
          // or function bodies. Evaluation rejects assignments and unknown calls.
          let consumer = expression;
          while (
            ts.isCallExpression(consumer.parent) ||
            ((ts.isPropertyAccessExpression(consumer.parent) ||
              ts.isElementAccessExpression(consumer.parent)) &&
              consumer.parent.expression === consumer)
          )
            consumer = consumer.parent as ts.Expression;
          const result = evaluate(consumer);
          if (typeof result !== 'string' && typeof result !== 'number') invalid.add(symbol);
        }
      }
    }
    ts.forEachChild(node, inspectProfileReferences);
  };
  inspectProfileReferences(file);
  const isProfileNumber = (
    node: ts.Expression,
    argumentsBySymbol = new Map<ts.Symbol, ts.Expression>(),
  ): boolean => {
    const symbol = ts.isIdentifier(node) ? symbolAt(node) : undefined;
    if (symbol && argumentsBySymbol.has(symbol))
      return isProfileNumber(argumentsBySymbol.get(symbol) as ts.Expression);
    if (isTransparentExpression(node)) return isProfileNumber(node.expression, argumentsBySymbol);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const root = rootExpression(node);
      return (
        ts.isIdentifier(root) &&
        profiles.has(symbolAt(root) as ts.Symbol) &&
        typeof evaluate(node) === 'number'
      );
    }
    if (ts.isBinaryExpression(node)) {
      const literalScale = (value: ts.Expression) => {
        if (!ts.isNumericLiteral(value)) return false;
        const scale = Number(value.text);
        return Number.isFinite(scale) && scale !== 0;
      };
      if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken)
        return (
          (isProfileNumber(node.left, argumentsBySymbol) && literalScale(node.right)) ||
          (literalScale(node.left) && isProfileNumber(node.right, argumentsBySymbol))
        );
      return (
        node.operatorToken.kind === ts.SyntaxKind.SlashToken &&
        isProfileNumber(node.left, argumentsBySymbol) &&
        literalScale(node.right)
      );
    }
    return (
      ts.isPrefixUnaryExpression(node) &&
      (node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken) &&
      isProfileNumber(node.operand, argumentsBySymbol)
    );
  };
  const isProfileInterpolation = (node: ts.Expression): boolean => {
    if (typeof evaluate(node) === 'number') return isProfileNumber(node);
    if (!ts.isCallExpression(node) || typeof evaluate(node) !== 'string') return false;
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
    const args = new Map<ts.Symbol, ts.Expression>();
    fn.expression.parameters.forEach((parameter, index) => {
      const symbol = ts.isIdentifier(parameter.name) && symbolAt(parameter.name);
      if (symbol && node.arguments[index]) args.set(symbol, node.arguments[index] as ts.Expression);
    });
    return isProfileNumber(body.templateSpans[0]?.expression as ts.Expression, args);
  };
  return { evaluate, isProfileInterpolation };
}
