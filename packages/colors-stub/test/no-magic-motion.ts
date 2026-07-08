/**
 * Сканер no-magic-motion — временной близнец размерных/цветовых гардов.
 *
 * Закон (wiring #125): каждая длительность/задержка перехода едет на роли
 * `--lab-motion-*` (semantic tier), потому что reduced-motion решается НА
 * УРОВНЕ ТОКЕНОВ — generated/motion.css перепривязывает роли под
 * `@media (prefers-reduced-motion: reduce)`. Голый ms-литерал в transition —
 * это не только дрейф сетки, это дыра в reduced-motion (ровно та, что жила в
 * lab-card.ts до wiring). Закрываются три класса:
 *
 *   1. MAGIC TRANSITION — временной литерал (`<n>ms|s`) в значении
 *      `transition` / `transition-duration` / `transition-delay`.
 *      Единственная легитимная форма — var(--lab-motion-…).
 *   2. MAGIC ANIMATION — временной литерал в `animation` /
 *      `animation-duration` вне LOOP_ALLOWLIST. Непрерывные keyframe-петли
 *      (спиннер, indeterminate-прогресс) не являются переходами и не имеют
 *      роли в семантической сетке — их перцептивные тайминги пришпилены
 *      к файлам явно; `0s`/`0ms` разрешён всегда (ручное глушение петли под
 *      reduced-motion — токены не останавливают @keyframes).
 *   3. MOTION FALLBACK — литеральный фолбэк `var(--lab-motion-X, <время>)`.
 *      Запрещён безусловно: кешированная длительность воскресила бы движение
 *      для reduced-motion-пользователя, если токен-слой не загрузился.
 *      Движение обязано отказывать в ноль (fail closed), не в 120ms.
 *
 * Lit-исходники читаются тем же нормализатором, что и размерный гард, — один
 * сканер на shadow-близнеца (TS) и React-близнеца (CSS).
 */
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { normalizeLit, stripComments } from './no-magic-dimension.js';
import { repoRoot } from './no-literal-colour-fallback.js';

/** Одна находка; форма зеркалит соседние гарды — один репортер на всех. */
export interface MotionViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: 'magic-transition' | 'magic-animation' | 'motion-fallback';
  readonly token: string;
  readonly detail: string;
}

/**
 * Непрерывные keyframe-петли с задокументированным перцептивным таймингом.
 * Запись пришпиливает значение к файлу: тот же литерал в любом другом файле —
 * нарушение. Новая петля добавляется сюда тем же PR, что её вводит, с
 * обоснованием тайминга в описании PR.
 */
export const LOOP_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  // 0.7s — период спиннера: заметно быстрее секунды (воспринимается «занят,
  // работает»), но без стробоскопа; общий для кнопки и лоадера на обоих стеках.
  'packages/react/src/button.css': ['0.7s'],
  'packages/react/src/loader.css': ['0.7s'],
  'packages/core/src/components/button/lab-button.ts': ['0.7s'],
  'packages/core/src/components/loader/lab-loader.ts': ['0.7s'],
  // 1.2s — проезд indeterminate-полосы: медленнее спиннера, потому что бежит
  // по длинной дорожке; короче — мельтешит, длиннее — выглядит зависшим.
  'packages/react/src/progress.css': ['1.2s'],
  'packages/core/src/components/progress/lab-progress.ts': ['1.2s'],
};

const TRANSITION_PROPS = new Set(['transition', 'transition-duration', 'transition-delay']);
const ANIMATION_PROPS = new Set(['animation', 'animation-duration']);

/** Временной литерал в значении декларации: `120ms`, `0.7s`, `2s`… */
const TIME_LITERAL = /(?<![\w-])(\d+(?:\.\d+)?)(ms|s)\b/g;

const isZero = (raw: string): boolean => Number.parseFloat(raw) === 0;

/**
 * Поверхность гарда: все компонентные стили обоих стеков. Волновой таблицы
 * нет намеренно — миграция моушена атомарна (wiring #125 перевёл все 74
 * transition-пары одним PR), поэтому закон действует на всё дерево сразу.
 */
export function motionSurfaceFiles(): string[] {
  const patterns = ['packages/react/src/*.css', 'packages/core/src/components/**/*.ts'];
  return patterns
    .flatMap((p) => globSync(p, { cwd: repoRoot }))
    .map((f) => relative(repoRoot, resolve(repoRoot, f)).replaceAll('\\', '/'))
    .filter((f) => !f.endsWith('.test.ts'));
}

/** Скан исходника одного файла; возвращает все нарушения моушен-контракта. */
export function scanMotionSource(relPath: string, source: string): MotionViolation[] {
  const out: MotionViolation[] = [];
  const isTs = relPath.endsWith('.ts');
  const text = stripComments(isTs ? normalizeLit(source) : source, isTs);
  const lineAt = (index: number): number => text.slice(0, index).split('\n').length;
  const allowedLoops = new Set(LOOP_ALLOWLIST[relPath] ?? []);

  // ── Правило 3: литеральный фолбэк на --lab-motion-* — в любом свойстве.
  for (const m of text.matchAll(/var\(\s*(--lab-motion-[a-z0-9-]+)\s*,\s*([^()]+)\)/g)) {
    out.push({
      file: relPath,
      line: lineAt(m.index ?? 0),
      rule: 'motion-fallback',
      token: m[0] as string,
      detail: `фолбэк "${(m[2] as string).trim()}" на ${m[1]} воскресит движение для reduced-motion, если токен-слой отсутствует — моушен отказывает в ноль, без кеша`,
    });
  }

  // ── Правила 1–2: временные литералы в transition- / animation-декларациях.
  // var()-группы предварительно растворяются (пробелами, сохраняя смещения):
  // литерал внутри фолбэка — это нарушение правила 3, не правил 1–2, и он
  // обязан дать ровно одну находку.
  let scrubbed = text;
  for (let pass = 0; pass < 8; pass++) {
    const next = scrubbed.replace(/var\([^()]*\)/g, (m) => ' '.repeat(m.length));
    if (next === scrubbed) break;
    scrubbed = next;
  }
  for (const decl of scrubbed.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const prop = decl[1] as string;
    const value = decl[2] as string;
    const at = decl.index ?? 0;
    const inTransition = TRANSITION_PROPS.has(prop);
    const inAnimation = ANIMATION_PROPS.has(prop);
    if (!inTransition && !inAnimation) continue;
    for (const t of value.matchAll(TIME_LITERAL)) {
      const literal = `${t[1]}${t[2]}`;
      if (inTransition) {
        out.push({
          file: relPath,
          line: lineAt(at),
          rule: 'magic-transition',
          token: literal,
          detail: `${prop}: временной литерал вместо var(--lab-motion-…) — мимо сетки и мимо токен-уровневого reduced-motion`,
        });
      } else if (!isZero(t[1] as string) && !allowedLoops.has(literal)) {
        out.push({
          file: relPath,
          line: lineAt(at),
          rule: 'magic-animation',
          token: literal,
          detail: `${prop}: тайминг петли не пришпилен к этому файлу в LOOP_ALLOWLIST (no-magic-motion.ts)`,
        });
      }
    }
  }
  return out;
}

/** Скан всей моушен-поверхности живого дерева. */
export function scanMotionSurface(): MotionViolation[] {
  return motionSurfaceFiles().flatMap((rel) =>
    scanMotionSource(rel, readFileSync(resolve(repoRoot, rel), 'utf8')),
  );
}
