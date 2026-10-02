/**
 * Инвариант парности акцентной роли между близнецами ADR-0001.
 *
 * У LabUI два рукописных рендер-слоя одного компонента: ядро (Lit, `litVar`) и
 * React-близнец (CSS `var()` + инлайн-стили в `.tsx`). Адаптеры (vue/svelte/
 * solid/astro) не несут своего CSS — они монтируют ядровый кастом-элемент, потому
 * их стайлинг ТОЖДЕСТВЕНЕН ядру по построению. Единственная ось, где может
 * возникнуть рассинхрон акцента, — ядро ↔ React.
 *
 * Закон (миссия «акцент = одна роль, читаемая одинаково»): для КАЖДОГО компонента,
 * присутствующего в обоих слоях, МНОЖЕСТВО прочитанных акцентных ролей
 * (`--lab-*accent*`: fill-accent / fill-accent-tinted / label-accent /
 * label-on-accent / border-accent) в ядре обязано совпадать с множеством в
 * React-близнеце. Правка одного слоя без зеркальной правки другого = дрейф,
 * который этот гейт валит, называя компонент и расходящиеся токены.
 *
 * Framework-free (сканирование текста), тот же repoRoot и `stripComments`, что и
 * у соседних гардов — комментарии/проза срезаются ДО матчинга, поэтому упоминание
 * `--lab-label-accent` в doc-комментарии не считается потреблением; считаются
 * только реальные `litVar('--lab-…')` (ядро) и `var(--lab-…)` (React).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './no-magic-dimension.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Repo root — из `test/` внутри `packages/colors`, три уровня вверх. */
export const repoRoot = resolve(here, '..', '..', '..');

/**
 * Акцентный токен внутри реального потребления. Две авторские формы:
 *   - ядро:   `litVar('--lab-…accent…')`
 *   - React:  `var(--lab-…accent…)` (CSS и инлайн-стиль .tsx)
 * Прозаический `--lab-label-accent` в комментарии не матчится (нет обёртки) —
 * плюс комментарии всё равно срезаются `stripComments` до матчинга.
 */
const ACCENT_CONSUMPTION = /(?:litVar\(\s*['"`]|var\(\s*)(--lab-[a-z0-9-]*accent[a-z0-9-]*)/g;

/** Извлечь множество акцентных ролей, реально потреблённых в исходнике. */
export function accentTokens(source: string, isTs: boolean): Set<string> {
  const clean = stripComments(source, isTs);
  const set = new Set<string>();
  for (const m of clean.matchAll(ACCENT_CONSUMPTION)) set.add(m[1] as string);
  return set;
}

/** Тождество множеств (порядок и кратность не важны — роль либо читается, либо нет). */
export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** Один компонент и его файлы в обоих слоях. */
export interface Twin {
  readonly name: string;
  readonly coreFile: string;
  readonly reactFiles: readonly string[];
}

/**
 * Перечислить компоненты ядра (`packages/core/src/components/<name>/lab-<name>.ts`)
 * вместе с их React-файлами (`packages/react/src/<name>.{css,tsx}`, если есть).
 */
export function twins(): Twin[] {
  const compDir = resolve(repoRoot, 'packages/core/src/components');
  const out: Twin[] = [];
  for (const name of readdirSync(compDir).sort()) {
    const coreFile = resolve(compDir, name, `lab-${name}.ts`);
    if (!existsSync(coreFile)) continue;
    const reactFiles = [`${name}.css`, `${name}.tsx`]
      .map((f) => resolve(repoRoot, 'packages/react/src', f))
      .filter((f) => existsSync(f));
    out.push({ name, coreFile, reactFiles });
  }
  return out;
}

/** Отчёт парности по одному компоненту. */
export interface ParityRow {
  readonly name: string;
  readonly core: Set<string>;
  readonly react: Set<string>;
  readonly hasReactTwin: boolean;
}

/**
 * Полный отчёт: акцентные множества ядра и React по каждому компоненту.
 * Компоненты без акцентных чтений в обоих слоях опускаются (нечего сверять).
 */
export function accentParity(): ParityRow[] {
  const rows: ParityRow[] = [];
  for (const t of twins()) {
    const core = accentTokens(readFileSync(t.coreFile, 'utf8'), true);
    const react = new Set<string>();
    for (const f of t.reactFiles) {
      for (const tok of accentTokens(readFileSync(f, 'utf8'), f.endsWith('.tsx'))) react.add(tok);
    }
    if (core.size === 0 && react.size === 0) continue;
    rows.push({ name: t.name, core, react, hasReactTwin: t.reactFiles.length > 0 });
  }
  return rows;
}

/** Компоненты, чьи акцентные множества ядра и React расходятся (для гейта). */
export function accentDrift(rows: ParityRow[] = accentParity()): ParityRow[] {
  return rows.filter((r) => r.hasReactTwin && !setsEqual(r.core, r.react));
}
