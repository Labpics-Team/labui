/**
 * Анализатор ядра — выводит {@link Manifest} из исходников @labpics/ui-core.
 *
 * Читает публичные `index.ts` и файлы классов через TypeScript AST
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
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { ComponentMeta, Manifest, PropKind, PropMeta, SlotMeta } from './types.js';

/** Сырые данные одного класса до разрешения наследования. */
interface RawClass {
  readonly name: string;
  readonly extendsSymbol: ts.Symbol | undefined;
  readonly props: PropMeta[];
  readonly events: Set<string>;
  readonly slots: RawSlots;
  readonly mayRenderBase: boolean;
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

/**
 * Собственный render заменяет базовый. Ссылки на super.render в helper/alias
 * учитываются консервативно: анализатор не прослеживает поток значений.
 */
function mayRenderBase(cls: ts.ClassDeclaration): boolean {
  const members = cls.members.filter(
    (member) =>
      ts.canHaveModifiers(member) &&
      !ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword),
  );
  const ownRender = members.some(
    (member) =>
      member.name &&
      (((ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) &&
        member.name.text === 'render') ||
        (ts.isComputedPropertyName(member.name) &&
          ts.isStringLiteralLike(member.name.expression) &&
          member.name.expression.text === 'render')) &&
      ((ts.isMethodDeclaration(member) && member.body) ||
        (ts.isPropertyDeclaration(member) && member.initializer)),
  );
  if (!ownRender) return true;

  const visit = (node: ts.Node): boolean | undefined => {
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      node.expression.kind === ts.SyntaxKind.SuperKeyword &&
      (ts.isPropertyAccessExpression(node)
        ? node.name.text === 'render'
        : ts.isStringLiteralLike(node.argumentExpression) &&
          node.argumentExpression.text === 'render')
    ) {
      const use =
        ts.isCallExpression(node.parent) && node.parent.expression === node ? node.parent : node;
      // Отдельное выражение вычисляет и отбрасывает результат базового render.
      return ts.isExpressionStatement(use.parent) ? undefined : true;
    }
    return ts.forEachChild(node, visit);
  };
  return members.some((member) => ts.forEachChild(member, visit));
}

/** TypeScript разрешает alias; имя из строки не заменяет неизвестный symbol. */
function targetSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** Symbol базового класса сохраняет импортное переименование. */
function extractExtends(cls: ts.ClassDeclaration, checker: ts.TypeChecker): ts.Symbol | undefined {
  for (const clause of cls.heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    const type = clause.types[0];
    const symbol = type && checker.getSymbolAtLocation(type.expression);
    if (symbol) return targetSymbol(symbol, checker);
  }
  return undefined;
}

/** Разбирает один файл элемента: классы + вызовы define('tag', Class). */
function parseFile(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): { classes: Map<ts.Symbol, RawClass>; defines: Array<{ tag: string; classSymbol: ts.Symbol }> } {
  const classes = new Map<ts.Symbol, RawClass>();
  const defines: Array<{ tag: string; classSymbol: ts.Symbol }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (!symbol) throw new Error(`Не найден symbol класса ${node.name.text} в ${sf.fileName}`);
      classes.set(symbol, {
        name: node.name.text,
        extendsSymbol: extractExtends(node, checker),
        props: extractProps(node),
        events: extractEvents(node),
        slots: extractSlots(node),
        mayRenderBase: mayRenderBase(node),
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
      if (!tagArg || !ts.isStringLiteral(tagArg)) {
        throw new Error(`Регистрация в ${sf.fileName} требует строковый тег`);
      }
      if (!classArg || !ts.isIdentifier(classArg)) {
        throw new Error(`Регистрация ${tagArg.text} требует именованный класс`);
      }
      const symbol = checker.getSymbolAtLocation(classArg);
      if (!symbol) throw new Error(`Не найден конструктор регистрации ${tagArg.text}`);
      defines.push({ tag: tagArg.text, classSymbol: targetSymbol(symbol, checker) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { classes, defines };
}

/** Импорт адаптера использует публичное имя конструктора, а не локальный alias. */
function publicClassName(
  entry: ts.SourceFile,
  classSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  tag: string,
): string {
  const module = checker.getSymbolAtLocation(entry);
  const names = (module ? checker.getExportsOfModule(module) : [])
    .filter((symbol) => {
      if (symbol.name === 'default' || targetSymbol(symbol, checker) !== classSymbol) return false;
      return !(symbol.declarations ?? []).some((declaration) => {
        if (ts.isTypeOnlyImportOrExportDeclaration(declaration)) return true;
        if (!ts.isExportSpecifier(declaration)) return false;
        const local = checker.getExportSpecifierLocalTargetSymbol(declaration);
        return local?.declarations?.some(ts.isTypeOnlyImportOrExportDeclaration) ?? false;
      });
    })
    .map((symbol) => symbol.name);
  if (names.includes(classSymbol.name)) return classSymbol.name;
  if (names.length === 1 && names[0]) return names[0];
  throw new Error(`Регистрация ${tag}: нет однозначного публичного экспорта конструктора`);
}

/**
 * Анализирует каталог `packages/core/src/components` и строит манифест.
 * @param componentsDir абсолютный путь к каталогу компонентов ядра.
 */
export function analyzeCore(componentsDir: string): Manifest {
  const classMap = new Map<ts.Symbol, RawClass>();
  const files: Array<{ path: string; entry: string | undefined }> = [];

  for (const dirent of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dir = join(componentsDir, dirent.name);
    const entryPath = join(dir, 'index.ts');
    const entry = existsSync(entryPath) ? entryPath : undefined;
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.ts')) files.push({ path: join(dir, file), entry });
    }
  }
  // Один Program связывает импорты/реэкспорты всех входов без второго resolver.
  const program = ts.createProgram(
    files.map((file) => file.path),
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  );
  const checker = program.getTypeChecker();
  const defines = new Map<string, { classSymbol: ts.Symbol; entry: ts.SourceFile }>();
  for (const file of files) {
    const source = program.getSourceFile(file.path);
    if (!source) throw new Error(`Не найден исходник ${file.path}`);
    const parsed = parseFile(source, checker);
    for (const [symbol, raw] of parsed.classes) classMap.set(symbol, raw);
    if (!file.entry) continue;
    const entry = program.getSourceFile(file.entry);
    if (!entry) throw new Error(`Не найден публичный вход ${file.entry}`);
    for (const definition of parsed.defines) {
      const previous = defines.get(definition.tag);
      if (previous && previous.classSymbol !== definition.classSymbol) {
        throw new Error(`Регистрация ${definition.tag} указывает на разные конструкторы`);
      }
      defines.set(definition.tag, { classSymbol: definition.classSymbol, entry });
    }
  }

  // Разрешение наследования: alert-dialog наследует пропы/события/слоты dialog.
  interface Resolved {
    props: PropMeta[];
    events: Set<string>;
    slots: RawSlots;
  }
  const resolved = new Map<ts.Symbol, Resolved>();
  const resolve = (classSymbol: ts.Symbol): Resolved => {
    const cached = resolved.get(classSymbol);
    if (cached) return cached;
    const raw = classMap.get(classSymbol);
    if (!raw) throw new Error(`Не найден исходный класс ${classSymbol.name}`);
    const base =
      raw.extendsSymbol && classMap.has(raw.extendsSymbol)
        ? resolve(raw.extendsSymbol)
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
        fill: new Set<string>([...(raw.mayRenderBase ? base.slots.fill : []), ...raw.slots.fill]),
      },
    };
    resolved.set(classSymbol, merged);
    return merged;
  };

  const components: ComponentMeta[] = [...defines]
    .map(([tag, { classSymbol, entry }]): ComponentMeta => {
      if (!classMap.has(classSymbol))
        throw new Error(`Не найден исходный класс регистрации ${tag}`);
      const className = publicClassName(entry, classSymbol, checker, tag);
      const subpath = tag.replace(/^lab-/, '');
      const meta = resolve(classSymbol);
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
