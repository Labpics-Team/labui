import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const options: ts.CompilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

/** ESM-типы именуются через import mode; runtime остаётся у JS-сборки. */
export function cjsDeclarationImports(fileName: string, source: string): string {
  if (!fileName.endsWith('.d.cts')) throw new Error(`Ожидалась CJS-декларация: ${fileName}`);
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const cache = ts.createModuleResolutionCache(
    dirname(fileName),
    (name) => (ts.sys.useCaseSensitiveFileNames ? name : name.toLowerCase()),
    options,
  );
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
  const changes: Array<{ start: number; end: number; text: string }> = [];
  const attributes = ts.factory.createImportAttributes(
    ts.factory.createNodeArray([
      ts.factory.createImportAttribute(
        ts.factory.createStringLiteral('resolution-mode'),
        ts.factory.createStringLiteral('import'),
      ),
    ]),
  );
  const identifiers = new Set<string>();
  const collectIdentifiers = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);
    ts.forEachChild(node, collectIdentifiers);
  };
  collectIdentifiers(file);
  const binding = () => {
    let index = identifiers.size;
    while (identifiers.has(`cjsExport${index}`)) index++;
    const name = `cjsExport${index}`;
    identifiers.add(name);
    return ts.factory.createIdentifier(name);
  };
  const programs = new Map<string, { program: ts.Program; namespace: ts.ImportDeclaration }>();
  const namespaces = new Set<ts.ImportDeclaration>();
  const normalize = (name: string) => {
    const absolute = resolve(name).replaceAll('\\', '/');
    return ts.sys.useCaseSensitiveFileNames ? absolute : absolute.toLowerCase();
  };
  const moduleSymbols = (dependency: ts.ResolvedModuleFull, specifier: ts.StringLiteral) => {
    let entry = programs.get(dependency.resolvedFileName);
    if (!entry) {
      const namespace = ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(true, undefined, ts.factory.createNamespaceImport(binding())),
        specifier,
        attributes,
      );
      const host = ts.createCompilerHost(options, true);
      const getSourceFile = host.getSourceFile.bind(host);
      // Canonical import даёт compiler имя для generic constraints/defaults вместо пути FS.
      const contextSource = `${source}\n${printer.printNode(ts.EmitHint.Unspecified, namespace, file)}`;
      host.getSourceFile = (name, languageVersion, ...rest) =>
        normalize(name) === normalize(fileName)
          ? ts.createSourceFile(name, contextSource, languageVersion, true)
          : getSourceFile(name, languageVersion, ...rest);
      const program = ts.createProgram(
        [fileName, dependency.resolvedFileName],
        { ...options, strict: true },
        host,
      );
      entry = { program, namespace };
      programs.set(dependency.resolvedFileName, entry);
    }
    const { program, namespace } = entry;
    const checker = program.getTypeChecker();
    const declaration = program.getSourceFile(dependency.resolvedFileName);
    const symbol = declaration && checker.getSymbolAtLocation(declaration);
    if (!symbol) throw new Error(`Не найдены exports ${dependency.resolvedFileName}`);
    return {
      checker,
      namespace,
      context: program.getSourceFile(fileName),
      exports: new Map(checker.getExportsOfModule(symbol).map((item) => [item.name, item])),
    };
  };
  for (const statement of file.statements) {
    if (
      (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const name = statement.moduleSpecifier.text;
    // Внутренние chunks уже имеют собственный формат; node: не объявляет ESM-пакет.
    if (/^[.#/]|^node:/.test(name)) continue;
    const resolve = (mode: ts.ResolutionMode) =>
      ts.resolveModuleName(name, fileName, options, ts.sys, cache, undefined, mode).resolvedModule;
    // Dual-пакет сохраняет require types. ESM-only exports могут иметь лишь import branch.
    const dependency = resolve(ts.ModuleKind.CommonJS) ?? resolve(ts.ModuleKind.ESNext);
    if (!dependency) throw new Error(`Не найдена декларация ${name} из ${fileName}`);
    if (
      ts.getImpliedNodeFormatForFile(dependency.resolvedFileName, undefined, ts.sys, options) !==
      ts.ModuleKind.ESNext
    )
      continue;
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
        throw new Error(`Ожидались именованные ESM re-exports ${name} из ${fileName}`);
      }
      const { checker, context, exports, namespace } = moduleSymbols(
        dependency,
        statement.moduleSpecifier,
      );
      const declarations: ts.Statement[] = [];
      for (const item of statement.exportClause.elements) {
        const imported = item.propertyName ?? item.name;
        const symbol = exports.get(imported.text);
        if (!symbol) throw new Error(`Не найден export ${imported.text} из ${name}`);
        const target =
          symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
        for (const declaration of target.declarations ?? []) collectIdentifiers(declaration);
        const hasValue = !!(target.flags & ts.SymbolFlags.Value);
        if (statement.isTypeOnly || item.isTypeOnly || !hasValue) {
          declarations.push(
            ts.factory.createExportDeclaration(
              statement.modifiers,
              true,
              ts.factory.createNamedExports([
                ts.factory.updateExportSpecifier(item, false, item.propertyName, item.name),
              ]),
              statement.moduleSpecifier,
              attributes,
            ),
          );
          continue;
        }
        if (target.flags & (ts.SymbolFlags.Namespace | ts.SymbolFlags.Enum)) {
          throw new Error(`Не поддержан namespace re-export ${imported.text} из ${name}`);
        }
        const value = binding();
        if (target.flags & ts.SymbolFlags.Type) {
          const type = binding();
          const parameters = checker.symbolToTypeParameterDeclarations(
            target,
            context,
            ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.UseFullyQualifiedType,
          );
          if (parameters?.length) namespaces.add(namespace);
          declarations.push(
            ts.factory.createImportDeclaration(
              undefined,
              ts.factory.createImportClause(
                true,
                undefined,
                ts.factory.createNamedImports([
                  ts.factory.createImportSpecifier(false, imported, type),
                ]),
              ),
              statement.moduleSpecifier,
              attributes,
            ),
            ts.factory.createTypeAliasDeclaration(
              undefined,
              value,
              parameters,
              ts.factory.createTypeReferenceNode(
                type,
                parameters?.map((parameter) => ts.factory.createTypeReferenceNode(parameter.name)),
              ),
            ),
          );
        }
        declarations.push(
          ts.factory.createVariableStatement(
            [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
            ts.factory.createVariableDeclarationList(
              [
                ts.factory.createVariableDeclaration(
                  value,
                  undefined,
                  ts.factory.createIndexedAccessTypeNode(
                    ts.factory.createImportTypeNode(
                      ts.factory.createLiteralTypeNode(statement.moduleSpecifier),
                      attributes,
                      undefined,
                      undefined,
                      true,
                    ),
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(imported.text)),
                  ),
                ),
              ],
              ts.NodeFlags.Const,
            ),
          ),
          ts.factory.createExportDeclaration(
            statement.modifiers,
            false,
            ts.factory.createNamedExports([
              ts.factory.createExportSpecifier(false, value, item.name),
            ]),
          ),
        );
      }
      changes.push({
        start: statement.getStart(file),
        end: statement.end,
        text: declarations
          .map((node) => printer.printNode(ts.EmitHint.Unspecified, node, file))
          .join('\n'),
      });
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    const named =
      bindings && ts.isNamedImports(bindings)
        ? ts.factory.updateNamedImports(
            bindings,
            bindings.elements.map((item) =>
              ts.factory.updateImportSpecifier(item, false, item.propertyName, item.name),
            ),
          )
        : bindings;
    // import type допускает default либо bindings, но не оба сразу.
    const clauses = [
      ...(statement.importClause?.name
        ? [ts.factory.createImportClause(true, statement.importClause.name, undefined)]
        : []),
      ...(!statement.importClause?.name || named
        ? [
            ts.factory.createImportClause(
              true,
              undefined,
              named ?? ts.factory.createNamedImports([]),
            ),
          ]
        : []),
    ];
    changes.push({
      start: statement.getStart(file),
      end: statement.end,
      text: clauses
        .map((clause) =>
          printer.printNode(
            ts.EmitHint.Unspecified,
            ts.factory.updateImportDeclaration(
              statement,
              statement.modifiers,
              clause,
              statement.moduleSpecifier,
              attributes,
            ),
            file,
          ),
        )
        .join('\n'),
    });
  }
  const declaration = changes
    .reverse()
    .reduce(
      (declaration, change) =>
        declaration.slice(0, change.start) + change.text + declaration.slice(change.end),
      source,
    );
  return namespaces.size
    ? `${[...namespaces].map((node) => printer.printNode(ts.EmitHint.Unspecified, node, file)).join('\n')}\n${declaration}`
    : declaration;
}
