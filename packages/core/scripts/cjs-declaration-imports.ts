import { dirname } from 'node:path';
import ts from 'typescript';

const options: ts.CompilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

/** Ambient-базы классов допустимы с import type; runtime остаётся у JS-сборки. */
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
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
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
    const attributes = ts.factory.createImportAttributes(
      ts.factory.createNodeArray([
        ts.factory.createImportAttribute(
          ts.factory.createStringLiteral('resolution-mode'),
          ts.factory.createStringLiteral('import'),
        ),
      ]),
    );
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
  return changes
    .reverse()
    .reduce(
      (declaration, change) =>
        declaration.slice(0, change.start) + change.text + declaration.slice(change.end),
      source,
    );
}
