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
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { repoRoot } from './no-literal-colour-fallback.js';

/**
 * Компоненты, мигрированные на размерный контракт. Волна миграции ДОБАВЛЯЕТ
 * свой компонент сюда тем же PR, что мигрирует, — в этом вся церемония.
 * Каждая запись перечисляет все файлы, красящие компонент на любом рендерере.
 */
export const MIGRATED: Readonly<Record<string, readonly string[]>> = {
  'radio-group': [
    'packages/core/src/components/radio-group/lab-radio-group.ts',
    'packages/react/src/radio-group.css',
  ],
  accordion: [
    'packages/core/src/components/accordion/lab-accordion.ts',
    'packages/react/src/accordion.css',
  ],
  badge: ['packages/core/src/components/badge/lab-badge.ts', 'packages/react/src/badge.css'],
  breadcrumb: [
    'packages/core/src/components/breadcrumb/lab-breadcrumb.ts',
    'packages/react/src/breadcrumb.css',
  ],
  button: ['packages/core/src/components/button/lab-button.ts', 'packages/react/src/button.css'],
  card: ['packages/core/src/components/card/lab-card.ts', 'packages/react/src/card.css'],
  input: [
    'packages/core/src/components/input/lab-input.ts',
    'packages/core/src/components/field/field-styles.ts',
    'packages/react/src/input.css',
  ],
  kbd: ['packages/core/src/components/kbd/lab-kbd.ts', 'packages/react/src/kbd.css'],
  'pin-input': [
    'packages/core/src/components/pin-input/lab-pin-input.ts',
    'packages/react/src/pin-input.css',
  ],
  tabs: ['packages/core/src/components/tabs/lab-tabs.ts', 'packages/react/src/tabs.css'],
  textarea: [
    'packages/core/src/components/textarea/lab-textarea.ts',
    'packages/core/src/components/field/field-styles.ts',
    'packages/react/src/textarea.css',
  ],
  progress: [
    'packages/core/src/components/progress/lab-progress.ts',
    'packages/react/src/progress.css',
  ],
  loader: ['packages/core/src/components/loader/lab-loader.ts', 'packages/react/src/loader.css'],
  switch: ['packages/core/src/components/switch/lab-switch.ts', 'packages/react/src/switch.css'],
  checkbox: [
    'packages/core/src/components/checkbox/lab-checkbox.ts',
    'packages/react/src/checkbox.css',
  ],
  avatar: ['packages/core/src/components/avatar/lab-avatar.ts', 'packages/react/src/avatar.css'],
  dialog: ['packages/core/src/components/dialog/lab-dialog.ts', 'packages/react/src/dialog.css'],
  'alert-dialog': [
    'packages/core/src/components/alert-dialog/lab-alert-dialog.ts',
    // React twin reuses <Dialog> (shares dialog.css); alert-dialog.tsx has no dimension literals.
  ],
  tooltip: [
    'packages/core/src/components/tooltip/lab-tooltip.ts',
    'packages/react/src/tooltip.css',
  ],
  'tags-input': [
    'packages/core/src/components/tags-input/lab-tags-input.ts',
    'packages/react/src/tags-input.css',
  ],
  combobox: [
    'packages/core/src/components/combobox/lab-combobox.ts',
    'packages/react/src/combobox.css',
  ],
  'number-input': [
    'packages/core/src/components/number-input/lab-number-input.ts',
    'packages/react/src/number-input.css',
  ],
  // НЕ мигрированы (аудит дрейфа shadcn, 2026-07-09): menu / select / pagination /
  // slider / popover. Их живые размеры дрейфанули от канона шкалы (наследие shadcn):
  //   control-h: 1.875rem→канон 2rem (s), 2.25rem→2.5rem (m), 2.75rem→3rem (l);
  //   slider:    border-radius 0.375rem→канон --lab-radius-xs 0.25rem;
  //   popover:   голые литералы 0.0625/0.625/1.125/1.5/9.0625rem без токенов шкалы.
  // Обернуть их в канонические токены = молча сдвинуть пиксели в рантайме — запрещено
  // мандатом байт-идентичности (#137). Нормализация — отдельным видимым PR с дизайн-
  // санкцией; до тех пор литералы остаются голыми и компоненты не в этом списке.
};

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
export function normalizeLit(source: string): string {
  return source
    .replace(/\$\{litVar\('(--lab-[a-z0-9-]+)',\s*'([^']+)'\)\}/g, 'var($1, $2)')
    .replace(/\$\{litVar\('(--lab-[a-z0-9-]+)'\)\}/g, 'var($1)')
    .replace(/\$\{litConcentricRadius\(([^)]*)\)\}/g, 'max(calc($1))');
}

/**
 * Срез комментариев (с сохранением переносов строк), чтобы проза никогда не
 * спотыкала сканер. Строчные `//` существуют только в TS (в CSS — только
 * блочные; то же обоснование url(//…), что у цветового гарда). Экспортирована:
 * сканер потребляемой поверхности (consumed-contract.ts) переиспользует её под
 * тот же закон — проза не является потреблением.
 */
export function stripComments(source: string, isTs: boolean): string {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (isTs) out = out.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  return out;
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
        if (fallback !== undefined && fallback.trim().length > 0 && name.startsWith('--lab-')) {
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
  const isTs = relPath.endsWith('.ts');
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
    const isTs = rel.endsWith('.ts');
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
  for (const files of Object.values(MIGRATED)) {
    for (const rel of files) {
      const source = readFileSync(resolve(repoRoot, rel), 'utf8');
      out.push(...scanDimensionSource(rel, source, canon));
    }
  }
  return out;
}
