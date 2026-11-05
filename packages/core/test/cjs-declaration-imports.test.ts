import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cjsDeclarationImports } from '../scripts/cjs-declaration-imports.js';

let temporary: string;
let litTemporary: string;

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
    'esm-values': {
      manifest: { type: 'module', exports: { '.': { types: './index.d.ts' } } },
      files: {
        'index.d.ts': `
export declare class Box<T extends string | number = string> {
  private value;
  constructor(value: T);
  get(): T;
}
export { Box as default };
export declare class Brand { private brand; }
export declare class Bounded<T extends Brand = Brand> {
  readonly value: T;
  constructor(value: T);
}
export declare function echo<T extends string>(value: T): T;
export declare const marker: unique symbol;
export interface Payload { source: 'esm'; }
`,
      },
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
  if (litTemporary) await rm(litTemporary, { recursive: true, force: true });
});

const compile = (file: string, lib = ['lib.es2022.d.ts']) =>
  ts.getPreEmitDiagnostics(
    ts.createProgram([file], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib,
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

it('сохраняет type/value re-exports, aliases, generic class identity и require branch', async () => {
  const declaration = join(temporary, 'reexports.d.cts');
  const file = join(temporary, 'reexports-consumer.cts');
  const source = `
export { Box, Box as AliasBox, default as DefaultBox, Bounded as Bound, Brand, echo as echoAlias, marker, Payload } from 'esm-values';
export { ImportedPayload } from 'import-only';
export { Branch } from 'dual-provider';
`;
  await writeFile(declaration, source);
  await writeFile(
    file,
    `
import { Box, AliasBox, DefaultBox, Bound, Brand, echoAlias, marker, type Payload, type ImportedPayload, type Branch } from './reexports.cjs';
import type * as Canonical from 'esm-values' with { 'resolution-mode': 'import' };
const constructor: typeof Canonical.Box = Box;
declare const canonicalConstructor: typeof Canonical.Box;
const constructorBack: typeof Box = canonicalConstructor;
const original: Canonical.Box<number> = new Box(1);
const instance: Box<number> = original;
const alias: AliasBox<number> = original;
const defaulted: DefaultBox<number> = original;
class Derived extends Box<number> {}
const defaultType: Box = new Box('default');
const bounded: Bound = new Bound(new Brand());
const boundedConstructor: typeof Canonical.Bounded = Bound;
const functionIdentity: typeof Canonical.echo = echoAlias;
const markerIdentity: typeof Canonical.marker = marker;
const payload: Payload = { source: 'esm' };
const imported: ImportedPayload = { source: 'import' };
const branch: Branch = 'require';
// @ts-expect-error Generic class сохраняет ограничения producer.
const invalidGeneric: Box<object> = original;
// @ts-expect-error Копия публичной структуры не имеет private identity Box.
const invalidClass: Box<number> = { get: () => 1 };
// @ts-expect-error Constraint ссылается на canonical private Brand.
const invalidBound: Bound<{}> = bounded;
// @ts-expect-error Generic function сохраняет literal result.
const invalidResult: 'other' = echoAlias('value');
void [constructor, constructorBack, instance, alias, defaulted, Derived, defaultType, bounded, boundedConstructor, functionIdentity, markerIdentity, payload, imported, branch, invalidGeneric, invalidClass, invalidBound, invalidResult];
`,
  );
  expect(compile(file).some((item) => item.code === 1479)).toBe(true);
  const rewritten = cjsDeclarationImports(declaration, source);
  await writeFile(declaration, rewritten);
  expect(cjsDeclarationImports(declaration, rewritten)).toBe(rewritten);
  expect(
    compile(file).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
  ).toEqual([]);
});

it('сохраняет constructor, instance и aliases настоящего LitElement в CJS re-export', async () => {
  const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  litTemporary = await mkdtemp(join(core, '.labui-cjs-exports-'));
  const declaration = join(litTemporary, 'lit-values.d.cts');
  const source =
    "export { LitElement, LitElement as AliasElement, html, TemplateResult } from 'lit';";
  await writeFile(declaration, source);
  const files = [];
  for (const extension of ['cts', 'mts']) {
    const file = join(litTemporary, `consumer.${extension}`);
    files.push(file);
    await writeFile(
      file,
      `
import { LitElement, AliasElement, html, type TemplateResult } from './lit-values.cjs';
import type { LitElement as CanonicalElement } from 'lit' with { 'resolution-mode': 'import' };
const constructor: typeof CanonicalElement = LitElement;
declare const canonicalConstructor: typeof CanonicalElement;
const constructorBack: typeof LitElement = canonicalConstructor;
const original: CanonicalElement = new LitElement();
const instance: LitElement = original;
const alias: AliasElement = original;
class Derived extends LitElement {}
const template: TemplateResult = html\`<span>content</span>\`;
type PublicElement = { [K in keyof CanonicalElement]: CanonicalElement[K] };
declare const copy: PublicElement;
// @ts-expect-error Публичная копия не имеет private/protected identity LitElement.
const invalid: LitElement = copy;
void [constructor, constructorBack, instance, alias, Derived, template, invalid];
`,
    );
  }
  const lib = ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'];
  expect(files.some((file) => compile(file, lib).some((item) => item.code === 1479))).toBe(true);
  const rewritten = cjsDeclarationImports(declaration, source);
  await writeFile(declaration, rewritten);
  expect(cjsDeclarationImports(declaration, rewritten)).toBe(rewritten);
  for (const file of files) {
    expect(
      compile(file, lib).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    ).toEqual([]);
  }
});

it('отказывает для неразрешённого пакета и runtime-исходника', () => {
  expect(() =>
    cjsDeclarationImports(join(temporary, 'missing.d.cts'), "import { Base } from 'missing';"),
  ).toThrow('Не найдена декларация missing');
  expect(() => cjsDeclarationImports(join(temporary, 'runtime.cts'), '')).toThrow(
    'Ожидалась CJS-декларация',
  );
});
