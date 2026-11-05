import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cjsDeclarationImports } from '../scripts/cjs-declaration-imports.js';

let temporary: string;

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-cjs-declarations-'));
  const packages = {
    'esm-only': {
      manifest: { type: 'module', exports: { '.': { types: './index.d.ts' } } },
      files: {
        'index.d.ts': `
export declare class Base { readonly source: 'esm'; }
export default Base;
export type Payload = string;
`,
      },
    },
    'import-only': {
      manifest: { type: 'module', exports: { '.': { import: { types: './index.d.ts' } } } },
      files: { 'index.d.ts': "export type ImportedPayload = { source: 'import' };" },
    },
    'cjs-only': {
      manifest: { type: 'commonjs', types: './index.d.ts' },
      files: { 'index.d.ts': "export declare class CjsBase { readonly source: 'cjs'; }" },
    },
    'dual-provider': {
      manifest: {
        type: 'module',
        exports: {
          '.': {
            import: { types: './index.d.mts' },
            require: { types: './index.d.cts' },
          },
        },
      },
      files: {
        'index.d.mts': "export type Branch = 'import';",
        'index.d.cts': "export type Branch = 'require';",
      },
    },
    'globals-only': {
      manifest: { type: 'module', types: './index.d.ts' },
      files: {
        'index.d.ts':
          "export {}; declare global { interface DeclarationMarker { value: 'global'; } }",
      },
    },
  };
  for (const [name, { manifest, files }] of Object.entries(packages)) {
    const directory = join(temporary, 'node_modules', name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
    for (const [file, source] of Object.entries(files)) {
      await writeFile(join(directory, file), source);
    }
  }
});

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

const compile = (file: string) =>
  ts.getPreEmitDiagnostics(
    ts.createProgram([file], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ['lib.es2022.d.ts'],
      types: [],
    }),
  );

it('разрешает ESM-типы и ambient-базы, сохраняя CJS/require-типы и global augmentation', async () => {
  const file = join(temporary, 'consumer.cts');
  const declaration = join(temporary, 'component.d.cts');
  const source = `
import DefaultBase, { type Base as NamedBase, type Payload } from 'esm-only';
import * as esm from 'esm-only';
import type { ImportedPayload } from 'import-only';
import { CjsBase } from 'cjs-only';
import { Branch } from 'dual-provider';
import 'globals-only';
declare class Component extends DefaultBase {
  payload: Payload;
  branch: Branch;
  named: NamedBase;
  namespace: esm.Base;
  imported: ImportedPayload;
}
declare class CjsComponent extends CjsBase {}
export { Component, CjsComponent };
`;
  await writeFile(
    file,
    `
import { Component, CjsComponent } from './component.cjs';
const component = new Component();
const esm: 'esm' = component.source;
const cjs: 'cjs' = new CjsComponent().source;
component.branch = 'require';
component.payload = 'payload';
const named: 'esm' = component.named.source;
const namespace: 'esm' = component.namespace.source;
component.imported = { source: 'import' };
const marker: DeclarationMarker = { value: 'global' };
void [esm, cjs, named, namespace, marker];
`,
  );
  await writeFile(declaration, source);
  expect(compile(file).some((item) => item.code === 1479)).toBe(true);
  const rewritten = cjsDeclarationImports(declaration, source);
  await writeFile(declaration, cjsDeclarationImports(declaration, rewritten));
  const diagnostics = compile(file);
  expect(
    diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
  ).toEqual([]);
});

it('отказывает для неразрешённого пакета и runtime-исходника', () => {
  expect(() =>
    cjsDeclarationImports(join(temporary, 'missing.d.cts'), "import { Base } from 'missing';"),
  ).toThrow('Не найдена декларация missing');
  expect(() => cjsDeclarationImports(join(temporary, 'runtime.cts'), '')).toThrow(
    'Ожидалась CJS-декларация',
  );
});
