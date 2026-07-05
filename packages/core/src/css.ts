/**
 * Token-consumption convention — the three languages, enforced in code.
 *
 * primitives -> semantic roles -> components. A component reads ONLY the
 * semantic role layer (`--lab-label-*`, `--lab-fill-*`, `--lab-border-*`,
 * `--lab-bg-*`, `--lab-fx-*`) and the dimension layer (`--lab-space-*`,
 * `--lab-radius-*`, `--lab-z-*`, `--lab-font-*`, `--lab-line-height-*`).
 * It NEVER reads a primitive (`--lab-neutral-*`, `--lab-accent-*`) and NEVER
 * hardcodes a hex. Material mechanics belong to `@labpics/ui-materials` and
 * are private (`--_*`) — a component never reads them at all.
 *
 * `cssVar` is the single way to reference a token in TS-authored styles, so the
 * `--lab-*` contract is the only surface a component touches. The exact role
 * names are owned by @labpics/colors (it extends the contract to the full
 * Labels/Fills/Border/Backgrounds/FX set); this scaffold depends on the NAMES,
 * never on the values.
 */

import { type CSSResult, unsafeCSS } from 'lit';

/** A `--lab-*` custom-property name (the only token shape a component may read). */
export type LabVar = `--lab-${string}`;

/**
 * Reference a token, optionally with a fallback. The fallback may be another
 * token (a `--lab-*` name → wrapped in its own `var()`, as CSS requires) or a
 * literal dimension value (e.g. `1rem`). Fallbacks are for DIMENSION tokens,
 * where a sensible default keeps a component usable before tokens load; role
 * (colour) tokens take no literal fallback — a missing role is a contract bug,
 * not something to paper over with a baked-in colour.
 */
export function cssVar(name: LabVar, fallback?: LabVar | (string & {})): string {
  if (fallback === undefined) return `var(${name})`;
  // A `--lab-*` fallback is a custom property, not a value: it must be `var()`-ed.
  const resolved = fallback.startsWith('--') ? `var(${fallback})` : fallback;
  return `var(${name}, ${resolved})`;
}

/**
 * The same token reference as `cssVar`, typed as a Lit `CSSResult` for use inside
 * a `css\`\`` template. The name is a controlled `--lab-*` token (never user
 * input), so `unsafeCSS` is safe here — it is the documented Lit way to splice a
 * computed token reference into scoped styles. Lit components use this; React /
 * inline-style consumers use the string `cssVar`.
 */
export function litVar(name: LabVar, fallback?: LabVar | (string & {})): CSSResult {
  return unsafeCSS(cssVar(name, fallback));
}

/**
 * Концентрический радиус (docs/dimension-contract.md §3): внутренний радиус
 * поверхности, вложенной на `inset` внутрь угла радиуса `outer`, равен
 * `outer - inset` с полом `--lab-radius-concentric-min` (2px) — глубокое
 * вложение скругляется, а не становится прямым углом (паттерн концентричности
 * Apple). Это ЕДИНСТВЕННЫЙ способ компонента вывести вложенный радиус;
 * копирование числа «на глаз» — класс дрейфа, который этот хелпер закрывает
 * (под гардом colors-stub/test/no-magic-dimension).
 *
 * `outer` / `inset` — CSS-выражения <length>: обычно ссылки `cssVar(...)` или
 * локальные ручки `var(--_x)`, никогда голые литералы.
 */
export function concentricRadius(outer: string, inset: string): string {
  // Скобки вокруг операндов обязательны: составное выражение в inset
  // («1px + 1px») без них меняет знак второй половины.
  return `max(calc((${outer}) - (${inset})), ${cssVar('--lab-radius-concentric-min', '0.125rem')})`;
}

/** `concentricRadius` в типе Lit `CSSResult` (то же обоснование, что у `litVar`). */
export function litConcentricRadius(outer: string, inset: string): CSSResult {
  return unsafeCSS(concentricRadius(outer, inset));
}

/**
 * The semantic role families a component is permitted to read. This is a
 * documentation+lint anchor, not an exhaustive enum (the full set is owned by
 * @labpics/colors) — it states the LANGUAGE boundary: these prefixes are legal,
 * primitive prefixes are not.
 */
export const SEMANTIC_ROLE_PREFIXES = [
  '--lab-label-', // text / foreground
  '--lab-fill-', // surface fills
  '--lab-border-', // borders
  '--lab-bg-', // backgrounds
  '--lab-fx-', // glow / focus-ring / shadow / skeleton
  '--lab-badge-', // component pair roles (crate::pair — fill + label-on)
] as const;

/** The dimension role families (from @labpics/ui-tokens). Always legal to read. */
export const DIMENSION_PREFIXES = [
  '--lab-space-',
  '--lab-size-', // габариты контрол-бокса оси размера компонента
  '--lab-radius-',
  '--lab-z-',
  '--lab-font-',
  '--lab-line-height-',
  '--lab-letter-spacing-', // оптический трекинг, парный кеглям (волна типографики)
  '--lab-measure-', // мера строки, ch (Bringhurst 45/66/75)
  '--lab-stroke-', // border / divider line widths (not the --lab-border-* colour role)
  '--lab-focus-ring-', // focus indicator width + offset
] as const;

/**
 * Primitive prefixes a component must NEVER read directly (they are the first of
 * the three languages, reserved for the colour engine). Listed so reviews and a
 * future lint rule have a concrete denylist.
 */
export const FORBIDDEN_PRIMITIVE_PREFIXES = ['--lab-neutral-', '--lab-accent-'] as const;

/** The three-language verdict for a `--lab-*` reference that component authors write. */
export type LabVarClass = 'semantic' | 'dimension' | 'forbidden-primitive' | 'unknown';

/**
 * Classify a `--lab-*` reference against the three-language boundary — the single
 * executable chokepoint built from the exported prefix constants (DIP: no second
 * copy of the rule). A component may read a `semantic` role or a `dimension`
 * token; a `forbidden-primitive` reference is a layer violation; an `unknown`
 * name matches no declared family. The prefix sets are disjoint, so match order
 * among them is irrelevant — extending any constant extends classification with
 * no further edit. A name outside the `--lab-` namespace is not a token this
 * library owns, so it is `unknown` up front (the prefix sets all start `--lab-`,
 * so this only documents intent — it never changes a verdict).
 */
export function classifyLabVar(name: string): LabVarClass {
  if (!name.startsWith('--lab-')) return 'unknown';
  if (SEMANTIC_ROLE_PREFIXES.some((p) => name.startsWith(p))) return 'semantic';
  if (DIMENSION_PREFIXES.some((p) => name.startsWith(p))) return 'dimension';
  if (FORBIDDEN_PRIMITIVE_PREFIXES.some((p) => name.startsWith(p))) return 'forbidden-primitive';
  return 'unknown';
}
