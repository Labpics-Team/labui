/** Строковые ссылки на семантические и размерные токены, без зависимости от рендерера. */
export type LabVar = `--lab-${string}`;

/** Резервное значение допускается для размеров; цвет задаёт семантическая роль. */
export function cssVar(name: LabVar, fallback?: LabVar | (string & {})): string {
  if (fallback === undefined) return `var(${name})`;
  // Ссылка на другое свойство требует собственного var().
  const resolved = fallback.startsWith('--') ? `var(${fallback})` : fallback;
  return `var(${name}, ${resolved})`;
}

/** Вложенный радиус ограничен минимумом из размерного контракта. */
export function concentricRadius(outer: string, inset: string): string {
  // Скобки сохраняют знак составного выражения inset.
  return `max(calc((${outer}) - (${inset})), ${cssVar('--lab-radius-concentric-min', '0.125rem')})`;
}

/** Семейства цветовых ролей; значения и полный набор принадлежат LabColors. */
export const SEMANTIC_ROLE_PREFIXES = [
  '--lab-label-',
  '--lab-fill-',
  '--lab-border-',
  '--lab-bg-',
  '--lab-fx-',
  '--lab-badge-',
] as const;

/** Семейства размерных и безразмерных токенов LabUI. */
export const DIMENSION_PREFIXES = [
  '--lab-space-',
  '--lab-size-',
  '--lab-radius-',
  '--lab-z-',
  '--lab-font-',
  '--lab-line-height-',
  '--lab-letter-spacing-',
  '--lab-measure-',
  '--lab-stroke-',
  '--lab-focus-ring-',
  '--lab-state-',
  '--lab-opacity-',
] as const;

/** Примитивы остаются внутри цветового движка; компоненты не читают их напрямую. */
export const FORBIDDEN_PRIMITIVE_PREFIXES = ['--lab-neutral-', '--lab-accent-'] as const;

export type LabVarClass = 'semantic' | 'dimension' | 'forbidden-primitive' | 'unknown';

/** Единая классификация ссылки по объявленным семействам. */
export function classifyLabVar(name: string): LabVarClass {
  if (!name.startsWith('--lab-')) return 'unknown';
  if (SEMANTIC_ROLE_PREFIXES.some((p) => name.startsWith(p))) return 'semantic';
  if (DIMENSION_PREFIXES.some((p) => name.startsWith(p))) return 'dimension';
  if (FORBIDDEN_PRIMITIVE_PREFIXES.some((p) => name.startsWith(p))) return 'forbidden-primitive';
  return 'unknown';
}
