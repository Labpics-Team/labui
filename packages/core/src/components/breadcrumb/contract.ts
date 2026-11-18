import { breadcrumbProfile } from '@labpics/ui-tokens';

export type LabBreadcrumbSize = 's' | 'm' | 'l';

export interface LabBreadcrumbItem {
  /** Stable identity when a destination or grouping label can change. */
  readonly id?: string;
  readonly label: string;
  /** Native destination. Omit for a grouping label or the current page. */
  readonly href?: string;
}

/** A reflected JSON attribute carries the same navigation through SSR and hydration. */
export function parseBreadcrumbItems(value: string | null): ReadonlyArray<LabBreadcrumbItem> {
  if (value === null) return [];
  try {
    const items: unknown = JSON.parse(value);
    return Array.isArray(items) &&
      items.every(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.label === 'string' &&
          (item.href === undefined || typeof item.href === 'string') &&
          (item.id === undefined || typeof item.id === 'string'),
      )
      ? items
      : [];
  } catch {
    return [];
  }
}

/** Preserve the item, including browser focus, when ancestors are inserted or removed. */
export function breadcrumbKeys(items: ReadonlyArray<LabBreadcrumbItem>): string[] {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const identity =
      item.id != null
        ? `id:${item.id}`
        : item.href != null
          ? `href:${item.href}`
          : `label:${item.label}`;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return `${identity.length}:${identity}:${occurrence}`;
  });
}

export function breadcrumbSize(value: unknown): LabBreadcrumbSize {
  return value === 's' || value === 'l' ? value : 'm';
}

/** Count includes the disclosure. Zero keeps every ancestor visible. */
export function breadcrumbLimit(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && (value === 0 || value >= 3)
    ? value
    : breadcrumbProfile.defaultMaxItems;
}

/** -1 is the single disclosure; other values are indices in the untouched trail. */
export function breadcrumbIndices(length: number, limit: number, expanded: boolean): number[] {
  if (expanded || limit === 0 || length <= limit)
    return Array.from({ length }, (_, index) => index);
  return [0, -1, ...Array.from({ length: limit - 2 }, (_, index) => length - limit + 2 + index)];
}
