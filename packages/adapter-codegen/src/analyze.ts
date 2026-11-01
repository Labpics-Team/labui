/**
 * Анализатор ядра — выводит {@link Manifest} из исходников @labpics/ui-core.
 *
 * Читает каждый `packages/core/src/components/*​/lab-*.ts` через TypeScript AST
 * (не regex — Lit-декларации нерегулярны для строкового разбора) и извлекает:
 *   - тег и класс      — из `customElements.define('lab-x', LabX)` (в т.ч. внутри
 *     register-функции, как у dialog/alert-dialog);
 *   - пропы            — из `static properties = { … }` (имя, атрибут, вид);
 *   - события          — из `new CustomEvent<…>('name', …)` в теле класса;
 *   - наследование     — `alert-dialog extends dialog` наследует пропы/события.
 *
 * `field` намеренно не элемент (shared a11y-хелпер, нет `customElements.define`),
 * поэтому в манифест не попадает — как и в родном React-рендерере.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { ComponentMeta, Manifest, PropKind, PropMeta, SlotMeta } from './types.js';

/** Сырые данные одного класса до разрешения наследования. */
interface RawClass {
  readonly name: string;
  readonly extendsName: string | undefined;
  readonly props: PropMeta[];
  readonly events: Set<string>;
  readonly slots: RawSlots;
}

/** Слоты класса до слияния наследования. */
interface RawSlots {
  default: boolean;
  named: Set<string>;
  dynamic: boolean;
  fill: Set<string>;
}

/** Пустые слоты — стартовое значение при слиянии. */
function emptySlots(): RawSlots {
  return { default: false, named: new Set<string>(), dynamic: false, fill: new Set<string>() };
}

/** kebab → PascalCase: 'alert-dialog' → 'AlertDialog'. */
function toPascal(subpath: string): string {
  return subpath
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Достаёт текст статической опции-строки (`attribute: 'x'`) или маркеры false/converter. */
function readPropOptions(init: ts.Expression): {
  attr: string | undefined;
  attributeFalse: boolean;
  isBoolean: boolean;
  hasConverter: boolean;
  isComplexType: boolean;
  isState: boolean;
} {
  let attr: string | undefined;
  let attributeFalse = false;
  let isBoolean = false;
  let hasConverter = false;
  let isComplexType = false;
  let isState = false;
  if (ts.isObjectLiteralExpression(init)) {
    for (const opt of init.properties) {
      if (!ts.isPropertyAssignment(opt) || !ts.isIdentifier(opt.name)) continue;
      const key = opt.name.text;
      if (key === 'attribute') {
        if (ts.isStringLiteral(opt.initializer)) attr = opt.initializer.text;
        else if (opt.initializer.kind === ts.SyntaxKind.FalseKeyword) attributeFalse = true;
      } else if (key === 'type') {
        if (ts.isIdentifier(opt.initializer)) {
          const t = opt.initializer.text;
          if (t === 'Boolean') isBoolean = true;
          // Object/Array — непримитив: атрибут из массива стал бы "[object Object]",
          // поэтому такой проп передаём JS-свойством даже без attribute:false/converter.
          else if (t === 'Object' || t === 'Array') isComplexType = true;
        }
      } else if (key === 'converter') {
        hasConverter = true;
      } else if (key === 'state') {
        // { state: true } — внутреннее реактивное состояние Lit, не публичный проп.
        if (opt.initializer.kind === ts.SyntaxKind.TrueKeyword) isState = true;
      }
    }
  }
  return { attr, attributeFalse, isBoolean, hasConverter, isComplexType, isState };
}

/** Классифицирует проп по опциям Lit (см. {@link PropKind}). */
function classify(o: ReturnType<typeof readPropOptions>): PropKind {
  if (o.isBoolean) return 'boolean';
  if (o.attributeFalse || o.hasConverter || o.isComplexType) return 'prop';
  return 'string';
}

/** Извлекает пропы из `static (override) properties = { … }` класса. */
function extractProps(cls: ts.ClassDeclaration): PropMeta[] {
  const props: PropMeta[] = [];
  for (const member of cls.members) {
    if (!ts.isPropertyDeclaration(member)) continue;
    const isStatic = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
    const name = member.name;
    const isProperties =
      (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === 'properties';
    if (!isStatic || !isProperties || !member.initializer) continue;
    if (!ts.isObjectLiteralExpression(member.initializer)) continue;
    for (const entry of member.initializer.properties) {
      if (!ts.isPropertyAssignment(entry)) continue;
      const propName = ts.isIdentifier(entry.name)
        ? entry.name.text
        : ts.isStringLiteral(entry.name)
          ? entry.name.text
          : undefined;
      if (!propName) continue;
      const opts = readPropOptions(entry.initializer);
      // Внутреннее реактивное состояние ({ state: true }) — не публичный API.
      if (opts.isState) continue;
      const attr = opts.attr ?? propName;
      // Нативные ARIA-атрибуты (aria-label) не типизируем как проп — они доходят
      // до хоста нативным fall-through, как в обёртке-образце Button.
      if (attr.startsWith('aria-')) continue;
      props.push({ name: propName, attr, kind: classify(opts) });
    }
  }
  return props;
}

/** Собирает имена кастом-событий из тела класса. */
function extractEvents(cls: ts.ClassDeclaration): Set<string> {
  const events = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'CustomEvent'
    ) {
      const nameArg = node.arguments?.[0];
      if (nameArg && ts.isStringLiteral(nameArg)) events.add(nameArg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(cls);
  return events;
}

/**
 * Извлекает слоты из текста класса (Lit-шаблон `render()`). Разбор простых
 * `<slot>`-паттернов regex-ом оправдан: это HTML внутри шаблонной строки, а не TS.
 *   - `<slot>` / `<slot ...>` без name → слот по умолчанию;
 *   - `<slot name="content">` → статический именованный слот;
 *   - `<slot name=${…}>` → динамический слот (имя вычисляется — перечислить нельзя).
 */
function extractSlots(cls: ts.ClassDeclaration): RawSlots {
  const text = cls.getText();
  const slots = emptySlots();
  const re = /<slot\b([^>]*)>/g;
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    const attrs = match[1] ?? '';
    const named = /name\s*=\s*"([^"]+)"/.exec(attrs);
    if (named?.[1]) {
      slots.named.add(named[1]);
      if (/data-sizing\s*=\s*"fill"/.test(attrs)) slots.fill.add(named[1]);
    } else if (/name\s*=\s*\$\{/.test(attrs)) slots.dynamic = true;
    else if (!/name\s*=/.test(attrs)) slots.default = true;
    match = re.exec(text);
  }
  return slots;
}

/** Имя базового класса из `extends X`. */
function extractExtends(cls: ts.ClassDeclaration): string | undefined {
  for (const clause of cls.heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    const type = clause.types[0];
    if (type && ts.isIdentifier(type.expression)) return type.expression.text;
  }
  return undefined;
}

/** Разбирает один файл элемента: классы + вызовы define('tag', Class). */
function parseFile(
  source: string,
  fileName: string,
): { classes: RawClass[]; defines: Array<{ tag: string; className: string }> } {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const classes: RawClass[] = [];
  const defines: Array<{ tag: string; className: string }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      classes.push({
        name: node.name.text,
        extendsName: extractExtends(node),
        props: extractProps(node),
        events: extractEvents(node),
        slots: extractSlots(node),
      });
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'customElements' &&
      node.expression.name.text === 'define'
    ) {
      const tagArg = node.arguments[0];
      const classArg = node.arguments[1];
      if (tagArg && classArg && ts.isStringLiteral(tagArg) && ts.isIdentifier(classArg)) {
        defines.push({ tag: tagArg.text, className: classArg.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { classes, defines };
}

/**
 * Анализирует каталог `packages/core/src/components` и строит манифест.
 * @param componentsDir абсолютный путь к каталогу компонентов ядра.
 */
export function analyzeCore(componentsDir: string): Manifest {
  const classMap = new Map<string, RawClass>();
  const defines: Array<{ tag: string; className: string }> = [];

  for (const dirent of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dir = join(componentsDir, dirent.name);
    for (const file of readdirSync(dir)) {
      // Только файлы элементов lab-*.ts (не index.ts / field-a11y.ts / field-styles.ts).
      if (!file.startsWith('lab-') || !file.endsWith('.ts')) continue;
      const parsed = parseFile(readFileSync(join(dir, file), 'utf8'), join(dir, file));
      for (const cls of parsed.classes) classMap.set(cls.name, cls);
      defines.push(...parsed.defines);
    }
  }

  // Разрешение наследования: alert-dialog наследует пропы/события/слоты dialog.
  interface Resolved {
    props: PropMeta[];
    events: Set<string>;
    slots: RawSlots;
  }
  const resolved = new Map<string, Resolved>();
  const resolve = (className: string): Resolved => {
    const cached = resolved.get(className);
    if (cached) return cached;
    const raw = classMap.get(className);
    if (!raw) return { props: [], events: new Set(), slots: emptySlots() };
    const base =
      raw.extendsName && classMap.has(raw.extendsName)
        ? resolve(raw.extendsName)
        : { props: [] as PropMeta[], events: new Set<string>(), slots: emptySlots() };
    // База сначала, затем собственные (одноимённый проп переопределяет базовый).
    const byName = new Map<string, PropMeta>();
    for (const p of base.props) byName.set(p.name, p);
    for (const p of raw.props) byName.set(p.name, p);
    const merged: Resolved = {
      props: [...byName.values()],
      events: new Set<string>([...base.events, ...raw.events]),
      slots: {
        default: base.slots.default || raw.slots.default,
        named: new Set<string>([...base.slots.named, ...raw.slots.named]),
        dynamic: base.slots.dynamic || raw.slots.dynamic,
        fill: new Set<string>([...base.slots.fill, ...raw.slots.fill]),
      },
    };
    resolved.set(className, merged);
    return merged;
  };

  const components: ComponentMeta[] = defines
    .map(({ tag, className }): ComponentMeta => {
      const subpath = tag.replace(/^lab-/, '');
      const meta = resolve(className);
      const slots: SlotMeta = {
        default: meta.slots.default,
        named: [...meta.slots.named].sort(),
        dynamic: meta.slots.dynamic,
        ...(meta.slots.fill.size ? { fill: [...meta.slots.fill].sort() } : {}),
      };
      return {
        tag,
        subpath,
        pascal: toPascal(subpath),
        className,
        props: meta.props,
        events: [...meta.events].sort(),
        slots,
      };
    })
    .sort((a, b) => a.subpath.localeCompare(b.subpath));

  return { version: 1, components };
}
