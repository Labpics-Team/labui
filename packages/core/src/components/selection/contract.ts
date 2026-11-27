import type { selectionProfile } from '@labpics/ui-tokens';

/** Shared selection meaning. Layout does not change the native action. */
export type LabSelectionType = 'accent' | 'neutral' | 'danger';
export type LabSelectionSize = keyof typeof selectionProfile.sizes;
export type LabSelectionChecked = boolean | 'indeterminate';
export type LabChoiceboxLayout = 'card' | 'row';
export type LabSelectionVariant = 'plain' | LabChoiceboxLayout;
export interface LabSelectionItem {
  readonly value: string;
  readonly label: string;
  readonly labelStart?: string;
  readonly description?: string;
  readonly disabled?: boolean;
}
export function parseSelectionItems(raw: string | null): LabSelectionItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((item): item is LabSelectionItem => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.value !== 'string' ||
        typeof item.label !== 'string' ||
        seen.has(item.value)
      )
        return false;
      seen.add(item.value);
      return true;
    });
  } catch {
    return [];
  }
}
/** Single native radio keyboard path, including deterministic Home/End. */
export function navigateRadio(event: KeyboardEvent, inputs: readonly HTMLInputElement[]): void {
  if (
    !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const enabled = inputs.filter((input) => !input.matches(':disabled'));
  const current = enabled.indexOf(event.target as HTMLInputElement);
  if (current < 0 || !enabled.length) return;
  event.preventDefault();
  const rtl = getComputedStyle(enabled[current] as HTMLInputElement).direction === 'rtl';
  let next: number;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = enabled.length - 1;
  else {
    const forward =
      event.key === 'ArrowDown' ||
      (event.key === 'ArrowRight' && !rtl) ||
      (event.key === 'ArrowLeft' && rtl);
    next = (current + (forward ? 1 : -1) + enabled.length) % enabled.length;
  }
  enabled[next]?.focus();
  enabled[next]?.click();
}
