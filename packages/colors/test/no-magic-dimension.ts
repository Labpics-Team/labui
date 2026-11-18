/**
 * Сканер no-magic-dimension — размерный близнец цветовых гардов.
 *
 * docs/dimension-contract.md — закон, который этот гард исполняет, в скоупе
 * компонентов, УЖЕ мигрированных на размерный контракт (`MIGRATED` ниже;
 * расширение — по волнам миграции, немигрированные компоненты не краснеют).
 * Закрываются три класса:
 *
 *   1. MAGIC LENGTH — голый литерал `<n>px|rem|em` в значении декларации.
 *      Каждый размер обязан ехать на `--lab-*` токене (или calc/пропорции над
 *      ним). Единственные легитимные голые px — хэйрлайны контракта
 *      (§4: 0 / ±1px / ±2px — значения, которые Figma-коллекция Unit держит
 *      инвариантными во всех четырёх режимах масштаба).
 *   2. MAGIC RADIUS — `border-radius`, чьё значение не составлено чисто из
 *      ссылок на токены/ручки (плюс концентрическая форма `max(calc(…))`, §3).
 *   3. FALLBACK DRIFT — `var(--lab-X, <литерал>)`, чей литерал не равен канону
 *      `--lab-X` в сгенерированном tokens.css (для fluid clamp()-токенов — не
 *      лежит в границах clamp). Фолбэк — кешированная копия токена; протухшая
 *      копия = тихий дрейф — ровно тот баг, что этот PR нашёл в radio-group
 *      (`--lab-space-md, 0.75rem` при каноне 1rem).
 *
 * Lit-исходники сперва нормализуются (`litVar('X', 'f')` → `var(X, f)`), так
 * что один сканер читает shadow-близнеца (TS) и React-близнеца (CSS) одинаково.
 */
import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { classify } from './consumed-contract.js';
import { cssImports, stripComments } from './css-source.js';
export { stripComments } from './css-source.js';
import { repoRoot } from './no-literal-colour-fallback.js';

/** Migration status is per component; source files follow its actual imports. */
const MIGRATED_COMPONENTS = [
  'radio-group',
  'accordion',
  'badge',
  'breadcrumb',
  'button',
  'card',
  'input',
  'kbd',
  'pin-input',
  'tabs',
  'textarea',
  'progress',
  'loader',
  'switch',
  'checkbox',
  'avatar',
  'dialog',
  'alert-dialog',
  'tooltip',
  'tags-input',
  'combobox',
  'number-input',
] as const;

/** Collect local component styles, including shared field styles and CSS imports. */
export function componentFiles(name: string, sourceRoot = repoRoot): string[] {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(resolve(sourceRoot, file), 'utf8');
    const isCss = file.endsWith('.css');
    const imports = isCss
      ? cssImports(source)
      : ts.preProcessFile(source, true).importedFiles.map((imported) => imported.fileName);
    for (const imported of imports.filter((path) =>
      isCss ? !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(path) : path.startsWith('.'),
    )) {
      const base = resolve(sourceRoot, dirname(file), imported);
      const target = [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'), base].find(
        (path) => existsSync(path),
      );
      if (!target) throw new Error(`${file}: unresolved local import ${imported}`);
      const rel = relative(sourceRoot, target).replaceAll('\\', '/');
      if (rel.startsWith('packages/core/src/components/') || rel.startsWith('packages/react/src/'))
        visit(rel);
    }
  };
  visit(`packages/core/src/components/${name}/lab-${name}.ts`);
  const react = `packages/react/src/${name}.tsx`;
  if (existsSync(resolve(sourceRoot, react))) visit(react);
  return [...seen].sort();
}

export const MIGRATED: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  MIGRATED_COMPONENTS.map((name) => [name, componentFiles(name)]),
);

/** Одна находка; форма зеркалит цветовые гарды — один репортер на всех. */
export interface DimensionViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: 'magic-length' | 'magic-radius' | 'fallback-drift';
  readonly token: string;
  readonly detail: string;
}

/** Хэйрлайны §4: px-литералы, которые коллекция Unit держит масштабо-инвариантными. */
const HAIRLINE_PX = new Set([0, 1, 2, -1, -2]);

/** `litVar('--lab-x', '1rem')` / `litVar('--lab-x')` → `var(--lab-x, 1rem)`. */
export function normalizeLit(source: string, preserveOffsets = false): string {
  const replacement = (whole: string, value: string): string =>
    preserveOffsets ? value.padEnd(whole.length) : value;
  return source
    .replace(
      /\$\{litVar\('(--lab-[a-z0-9-]+)',\s*'([^']+)'\)\}/g,
      (whole, name: string, fallback: string) => replacement(whole, `var(${name}, ${fallback})`),
    )
    .replace(/\$\{litVar\('(--lab-[a-z0-9-]+)'\)\}/g, (whole, name: string) =>
      replacement(whole, `var(${name})`),
    )
    .replace(/\$\{litConcentricRadius\(([^)]*)\)\}/g, (whole, value: string) =>
      replacement(whole, `max(calc(${value}))`),
    );
}

/** Парсинг `<число><единица>` → px при корне 16px; null, если не длина. */
function lengthToPx(raw: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(raw.trim());
  if (!m) return null;
  const value = Number(m[1]);
  return m[2] === 'px' ? value : value * 16;
}

/**
 * Каноническая таблица токенов, распарсенная из СГЕНЕРИРОВАННОГО tokens.css
 * (SSOT-артефакт). Цепочки `var()`-алиасов разрешаются до финальной строки.
 */
export function canonicalTokens(): Map<string, string> {
  const css = readFileSync(resolve(repoRoot, 'packages/tokens/src/generated/tokens.css'), 'utf8');
  const raw = new Map<string, string>();
  for (const m of css.matchAll(/(--lab-[a-z0-9-]+):\s*([^;]+);/g)) {
    raw.set(m[1] as string, (m[2] as string).trim());
  }
  const resolveValue = (value: string, depth = 0): string => {
    const ref = /^var\((--lab-[a-z0-9-]+)\)$/.exec(value);
    if (!ref || depth > 8) return value;
    const next = raw.get(ref[1] as string);
    return next === undefined ? value : resolveValue(next, depth + 1);
  };
  const out = new Map<string, string>();
  for (const [name, value] of raw) out.set(name, resolveValue(value));
  return out;
}

/**
 * Честно ли `literal` кеширует канон `canon`? Скалярные токены требуют точного
 * равенства величины (с нормализацией единиц); fluid clamp()-токены принимают
 * любое значение внутри якорей [min, max] (токен легитимно его принимает).
 * Безразмерный канон (line-height, font-weight) — равенство как чисел.
 */
export function fallbackMatchesCanon(literal: string, canon: string): boolean {
  const clamp = /^clamp\(\s*([^,]+),[^,]+,\s*([^)]+)\)$/.exec(canon);
  if (clamp) {
    const [lo, hi, fb] = [
      lengthToPx(clamp[1] as string),
      lengthToPx(clamp[2] as string),
      lengthToPx(literal),
    ];
    return lo !== null && hi !== null && fb !== null && fb >= lo && fb <= hi;
  }
  const canonPx = lengthToPx(canon);
  const literalPx = lengthToPx(literal);
  if (canonPx !== null && literalPx !== null) return Math.abs(canonPx - literalPx) < 0.01;
  return Number.parseFloat(literal) === Number.parseFloat(canon);
}

/**
 * Убирает каждую группу `var(...)` — попутно валидируя фолбэки `--lab-*`
 * против канона — и возвращает остаток для скана magic-length. Вложенные
 * группы снимаются изнутри наружу, так что `var(--a, var(--b, 1rem))`
 * растворяется полностью.
 */
function consumeVarGroups(
  text: string,
  file: string,
  lineAt: (index: number) => number,
  out: DimensionViolation[],
  canon: Map<string, string>,
): string {
  let current = text;
  const varGroup = /var\(\s*(--[a-z0-9-_]+)\s*(?:,\s*([^()]*))?\)/gi;
  for (let pass = 0; pass < 8; pass++) {
    let replaced = false;
    current = current.replace(
      varGroup,
      (whole, name: string, fallback: string | undefined, offset: number) => {
        replaced = true;
        // Пустой (после растворения вложенной var()-группы) фолбэк — ссылка на
        // другой токен, а не литеральный кеш: дрейф-проверке не подлежит.
        if (
          fallback !== undefined &&
          fallback.trim().length > 0 &&
          name.startsWith('--lab-') &&
          classify(name) !== 'local-or-gap'
        ) {
          const canonValue = canon.get(name);
          if (canonValue === undefined) {
            out.push({
              file,
              line: lineAt(offset),
              rule: 'fallback-drift',
              token: whole,
              detail: `${name} — не сгенерированный размерный токен: литеральному фолбэку не с чем сверяться`,
            });
          } else if (!fallbackMatchesCanon(fallback.trim(), canonValue)) {
            out.push({
              file,
              line: lineAt(offset),
              rule: 'fallback-drift',
              token: whole,
              detail: `фолбэк "${fallback.trim()}" дрейфанул от канона "${canonValue}" (${name})`,
            });
          }
        }
        return ' '.repeat(whole.length); // сохраняем смещения ради номеров строк
      },
    );
    if (!replaced) break;
  }
  return current;
}

/** Скан исходника одного мигрированного файла; возвращает все нарушения контракта. */
export function scanDimensionSource(
  relPath: string,
  source: string,
  canon: Map<string, string> = canonicalTokens(),
): DimensionViolation[] {
  const out: DimensionViolation[] = [];
  const isTs = /\.tsx?$/.test(relPath);
  const text = stripComments(isTs ? normalizeLit(source) : source, isTs);
  const lineAt = (index: number): number => text.slice(0, index).split('\n').length;

  // Правило 2 — magic radius: после снятия var()-групп значение border-radius
  // может держать только структурные calc-слова, операторы, пропорции и `inherit`/`0`.
  for (const m of text.matchAll(/border-radius:\s*([^;]+);/g)) {
    const at = m.index ?? 0;
    const cleaned = consumeVarGroups(m[1] as string, relPath, () => lineAt(at), out, canon);
    const residue = cleaned
      .replace(/\b(?:max|min|calc|clamp|inherit)\b/g, ' ')
      .replace(/[()\s,*/+-]|\b\d+(?:\.\d+)?\b/g, '');
    if (residue.length > 0) {
      out.push({
        file: relPath,
        line: lineAt(at),
        rule: 'magic-radius',
        token: (m[1] as string).trim(),
        detail:
          'border-radius обязан состоять из ссылок --lab-radius-* / локальных ручек (концентрический calc разрешён), не из литералов',
      });
    }
  }

  // Правила 1+3 — проход по всему файлу: растворить var()-группы (валидируя
  // фолбэки --lab-*), затем флагнуть остаточный литерал длины не-хэйрлайн.
  const residue = consumeVarGroups(text, relPath, lineAt, out, canon);
  for (const m of residue.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)(px|rem|em)\b/g)) {
    const px = lengthToPx(`${m[1]}${m[2]}`);
    if (m[2] === 'px' && px !== null && HAIRLINE_PX.has(px)) continue; // хэйрлайны §4
    // §1 (ADR-0006): em-длина — пропорция КЕГЛЯ, не фиксированный размер:
    // кегль сам едет на --lab-font-size-* токенах, значит em-значение уже
    // выражено через контракт (глифы/паддинги, масштабирующиеся со шрифтом).
    // Фиксированные длины обязаны быть rem/px — их ловим как раньше.
    if (m[2] === 'em') continue;
    out.push({
      file: relPath,
      line: lineAt(m.index ?? 0),
      rule: 'magic-length',
      token: m[0],
      detail:
        'голый литерал длины — потребляй --lab-* токен (литералы живут только в var()-фолбэках; px — только хэйрлайны §4)',
    });
  }

  return out;
}

/**
 * Правило fallback-drift глобально: дрейф кеша от канона — дефект в ЛЮБОМ
 * файле компонентов, независимо от волны миграции (в отличие от
 * magic-length/magic-radius, которые требуют перевода на токены и потому
 * скоупятся списком MIGRATED). Поверхность — стили обоих рендереров.
 */
export function fallbackSurfaceFiles(): string[] {
  const patterns = [
    'packages/react/src/**/*.css',
    'packages/react/src/**/*.tsx',
    'packages/react/src/**/*.ts',
    'packages/core/src/**/*.ts',
    // Glob no-magic-dimension to materials (playbook #137 A2): drift global + materials explicitly globbed via globSync for fallback (magic via MIGRATED only; private --_ effects exempt).
    // Derivations (thumb, dot) + control-h sizes + overlay globbed and expressed (calc + var(--lab-size-overlay-*)) .
    // control-h wired в 5 мигрированных (menu/select/pagination НЕ мигрированы — см. строку 98); thumb/dot use calc(var - var(--lab-...)) to pass guard.
    // Слепая зона закрыта; glob patterns cover packages/materials fully for drift.
    'packages/materials/src/**/*.css',
    'packages/tokens/src/**/*.ts',
  ];
  const out: string[] = [];
  for (const pattern of patterns) {
    for (const abs of globSync(resolve(repoRoot, pattern))) {
      const rel = relative(repoRoot, abs).split('\\').join('/');
      if (rel.includes('/dist/') || rel.includes('/node_modules/')) continue;
      if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
      out.push(rel);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Дрейф фолбэков по всей поверхности компонентов; живое дерево обязано вернуть []. */
export function scanFallbackDrift(): DimensionViolation[] {
  const canon = canonicalTokens();
  const out: DimensionViolation[] = [];
  for (const rel of fallbackSurfaceFiles()) {
    const isTs = /\.tsx?$/.test(rel);
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    const text = stripComments(isTs ? normalizeLit(source) : source, isTs);
    const lineAt = (index: number): number => text.slice(0, index).split('\n').length;
    const hits: DimensionViolation[] = [];
    consumeVarGroups(text, rel, lineAt, hits, canon);
    out.push(...hits.filter((v) => v.rule === 'fallback-drift'));
  }
  return out;
}

/** Скан всех мигрированных компонентов; живое дерево обязано вернуть []. */
export function scanMigrated(): DimensionViolation[] {
  const canon = canonicalTokens();
  const out: DimensionViolation[] = [];
  for (const rel of new Set(Object.values(MIGRATED).flat())) {
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    out.push(...scanDimensionSource(rel, source, canon));
  }
  return out;
}
