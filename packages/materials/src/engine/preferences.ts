/** Медиа меняют допуск живого материала; контраст разрешается в области элемента. */
const SYSTEM_DEGRADATIONS = [
  '(prefers-reduced-transparency: reduce)',
  '(forced-colors: active)',
] as const;
export const MATERIAL_ENGINE_MEDIA = [...SYSTEM_DEGRADATIONS, '(prefers-contrast: more)'] as const;

/** Принудительные цвета и снижение прозрачности не отменяются режимом normal. */
export function materialMediaBlocked(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return SYSTEM_DEGRADATIONS.some((query) => matchMedia(query).matches);
}

/** Colors уже разрешил ближайшую область и auto. Без его листа сохраняется OS-default. */
export function prefersMoreContrast(el: Element): boolean {
  const mode =
    typeof getComputedStyle === 'undefined'
      ? ''
      : getComputedStyle(el).getPropertyValue('--_lab-contrast-mode').trim();
  if (mode === 'normal') return false;
  if (mode === 'more') return true;
  if (mode !== '') throw new Error(`Неизвестный разрешённый режим контраста: ${mode}`);
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-contrast: more)').matches;
}
