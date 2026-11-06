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
export declare const Constructor: typeof Box;
export declare const BoundedConstructor: typeof Bounded;
export declare const BrandConstructor: typeof Brand;
export declare function echo<T extends string>(value: T): T;
export declare const marker: unique symbol;
export interface Payload { source: 'esm'; }
`,
      },
    },
    'esm-hidden': {
      manifest: { type: 'module', exports: { '.': { types: './index.d.ts' } } },
      files: {
        'index.d.ts': `
declare class Brand { private brand; }
export declare class Box<T extends Brand = Brand> {
  private value;
  constructor(value: T);
  get(): T;
}
export { Box as default };
export declare const token: Brand;
export declare const Constructor: typeof Box;
`,
      },
    },
    'cjs-only': {
      manifest: { type: 'commonjs', types: './index.d.ts' },
      files: {
        'index.d.ts': `export declare class CjsBase<T extends string = string> {
  private identity;
  constructor(value?: T);
  readonly source: 'cjs';
  value: T;
}`,
      },
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

it('сохраняет type-only class aliases, canonical constructor values и require branch', async () => {
  const declaration = join(temporary, 'reexports.d.cts');
  const files = ['cts', 'mts'].map((extension) =>
    join(temporary, `reexports-consumer.${extension}`),
  );
  const source = `
export type { Box, Box as AliasBox, default as DefaultBox, Bounded as Bound, Brand } from 'esm-values';
export { Constructor, BoundedConstructor, BrandConstructor, echo as echoAlias, marker, Payload } from 'esm-values';
export { ImportedPayload } from 'import-only';
export { Branch } from 'dual-provider';
`;
  await writeFile(declaration, source);
  for (const file of files) {
    await writeFile(
      file,
      `
import { Constructor, BoundedConstructor, BrandConstructor, echoAlias, marker, type Box, type AliasBox, type DefaultBox, type Bound, type Brand, type Payload, type ImportedPayload, type Branch } from './reexports.cjs';
import type * as Canonical from 'esm-values' with { 'resolution-mode': 'import' };
const constructor: typeof Canonical.Box = Constructor;
declare const canonicalConstructor: typeof Canonical.Box;
const constructorBack: typeof Constructor = canonicalConstructor;
const original: Canonical.Box<number> = new Constructor(1);
const instance: Box<number> = original;
const alias: AliasBox<number> = original;
const defaulted: DefaultBox<number> = original;
class Derived extends Constructor<number> {}
const defaultType: Box = new Constructor('default');
const brand: Brand = new BrandConstructor();
const bounded: Bound = new BoundedConstructor(brand);
const boundedConstructor: typeof Canonical.Bounded = BoundedConstructor;
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
void [constructor, constructorBack, instance, alias, defaulted, Derived, defaultType, brand, bounded, boundedConstructor, functionIdentity, markerIdentity, payload, imported, branch, invalidGeneric, invalidClass, invalidBound, invalidResult];
`,
    );
  }
  expect(files.some((file) => compile(file).some((item) => item.code === 1479))).toBe(true);
  const rewritten = cjsDeclarationImports(declaration, source);
  await writeFile(declaration, rewritten);
  expect(cjsDeclarationImports(declaration, rewritten)).toBe(rewritten);
  for (const file of files) {
    expect(
      compile(file).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    ).toEqual([]);
  }
});

it('сохраняет скрытые canonical bounds/defaults через type-only aliases и constructor value', async () => {
  const declaration = join(temporary, 'hidden-types.d.cts');
  const source = `
export type { Box, Box as AliasBox, default as DefaultBox } from 'esm-hidden';
export { Constructor, token } from 'esm-hidden';
`;
  await writeFile(declaration, source);
  const files = [];
  for (const extension of ['cts', 'mts']) {
    const file = join(temporary, `hidden-types-consumer.${extension}`);
    files.push(file);
    await writeFile(
      file,
      `
import { Constructor, token, type Box, type AliasBox, type DefaultBox } from './hidden-types.cjs';
import type * as Canonical from 'esm-hidden' with { 'resolution-mode': 'import' };
const constructor: typeof Canonical.Box = Constructor;
declare const canonicalConstructor: typeof Canonical.Box;
const constructorBack: typeof Constructor = canonicalConstructor;
const original: Canonical.Box = new Constructor(token);
const instance: Box = original;
const alias: AliasBox = original;
const defaulted: DefaultBox = original;
const canonical: Canonical.Box = instance;
class Derived extends Constructor {}
// @ts-expect-error Generic class сохраняет скрытое private ограничение producer.
const invalidGeneric: Box<{}> = original;
// @ts-expect-error Constructor сохраняет тот же скрытый bound.
const invalidArgument = new Constructor({});
type PublicBox = { [K in keyof Box]: Box[K] };
declare const copy: PublicBox;
// @ts-expect-error Копия публичной структуры не имеет private identity Box.
const invalidCopy: Box = copy;
void [constructor, constructorBack, instance, alias, defaulted, canonical, Derived, invalidGeneric, invalidArgument, invalidCopy];
`,
    );
  }
  expect(files.some((file) => compile(file).some((item) => item.code === 1479))).toBe(true);
  const rewritten = cjsDeclarationImports(declaration, source);
  await writeFile(declaration, rewritten);
  expect(cjsDeclarationImports(declaration, rewritten)).toBe(rewritten);
  for (const file of files) {
    expect(
      compile(file).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    ).toEqual([]);
  }
});

it('сохраняет именованные CJS class re-exports, generics и private identity', async () => {
  const declaration = join(temporary, 'cjs-class-reexports.d.cts');
  const source = "export { CjsBase, CjsBase as AliasBase } from 'cjs-only';";
  await writeFile(declaration, source);
  expect(cjsDeclarationImports(declaration, source)).toBe(source);
  for (const extension of ['cts', 'mts']) {
    const file = join(temporary, `cjs-class-consumer.${extension}`);
    await writeFile(
      file,
      `
import { CjsBase, AliasBase } from './cjs-class-reexports.cjs';
const constructor: typeof CjsBase = AliasBase;
const instance: CjsBase<'safe'> = new AliasBase('safe');
const alias: AliasBase<'safe'> = instance;
const defaulted: CjsBase = new CjsBase();
class Derived extends AliasBase<'safe'> {}
// @ts-expect-error Generic class сохраняет string constraint.
const invalidGeneric: CjsBase<object> = instance;
type PublicBase = { [K in keyof CjsBase]: CjsBase[K] };
declare const copy: PublicBase;
// @ts-expect-error Публичная копия не имеет private identity CjsBase.
const invalidCopy: CjsBase = copy;
void [constructor, instance, alias, defaulted, Derived, invalidGeneric, invalidCopy];
`,
    );
    expect(
      compile(file).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    ).toEqual([]);
  }
});

it('сохраняет constructor, instance и aliases класса с настоящей LitElement base', async () => {
  const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  litTemporary = await mkdtemp(join(core, '.labui-cjs-exports-'));
  const declaration = join(litTemporary, 'lit-values.d.cts');
  const source = `
import { LitElement as BaseElement } from 'lit';
export declare class Element extends BaseElement {}
export { Element as AliasElement };
export type { LitElement } from 'lit';
export { html, TemplateResult } from 'lit';
`;
  await writeFile(declaration, source);
  const files = [];
  for (const extension of ['cts', 'mts']) {
    const file = join(litTemporary, `consumer.${extension}`);
    files.push(file);
    await writeFile(
      file,
      `
import { Element, AliasElement, html, type LitElement, type TemplateResult } from './lit-values.cjs';
import type { LitElement as CanonicalElement } from 'lit' with { 'resolution-mode': 'import' };
const constructor: typeof CanonicalElement = Element;
declare const canonicalConstructor: typeof CanonicalElement;
const constructorBack: typeof Element = canonicalConstructor;
const original: CanonicalElement = new Element();
const instance: Element = original;
const canonical: LitElement = instance;
const alias: AliasElement = original;
class Derived extends Element {}
const template: TemplateResult = html\`<span>content</span>\`;
type PublicElement = { [K in keyof CanonicalElement]: CanonicalElement[K] };
declare const copy: PublicElement;
// @ts-expect-error Публичная копия не имеет private/protected identity LitElement.
const invalid: Element = copy;
void [constructor, constructorBack, instance, canonical, alias, Derived, template, invalid];
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

it('отказывает до выдачи mixed ESM class re-export со скрытым private constraint', async () => {
  const control = join(temporary, 'hidden-canonical-control.mts');
  await writeFile(
    control,
    `
import { Box, default as DefaultBox, Constructor, token } from 'esm-hidden';
const box: Box = new Constructor(token);
const alias: DefaultBox = box;
const constructor: typeof Box = Constructor;
class Derived extends Constructor {}
// @ts-expect-error Producer не допускает аргумент без private Brand.
const invalid: Box<{}> = box;
type PublicBox = { [K in keyof Box]: Box[K] };
declare const copy: PublicBox;
// @ts-expect-error Структурная копия не имеет private identity Box.
const invalidCopy: Box = copy;
void [box, alias, constructor, Derived, invalid, invalidCopy];
`,
  );
  expect(
    compile(control).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
  ).toEqual([]);
  for (const exports of ['Box', 'Box as AliasBox', 'default as DefaultBox']) {
    const declaration = join(temporary, 'hidden-class-reexport.d.cts');
    const source = `export { ${exports} } from 'esm-hidden';`;
    await writeFile(declaration, source);
    expect(() => cjsDeclarationImports(declaration, source)).toThrow(
      'Не поддержан ESM re-export с type/value identity',
    );
  }
  expect(() =>
    cjsDeclarationImports(
      join(temporary, 'exported-bound.d.cts'),
      "export { Bounded } from 'esm-values';",
    ),
  ).toThrow('Не поддержан ESM re-export с type/value identity');
});

it('отказывает для неразрешённого пакета и runtime-исходника', () => {
  expect(() =>
    cjsDeclarationImports(join(temporary, 'missing.d.cts'), "import { Base } from 'missing';"),
  ).toThrow('Не найдена декларация missing');
  expect(() => cjsDeclarationImports(join(temporary, 'runtime.cts'), '')).toThrow(
    'Ожидалась CJS-декларация',
  );
});
