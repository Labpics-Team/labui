import { breadcrumbProfile } from '@labpics/ui-tokens';

export type LabBreadcrumbSize = 's' | 'm' | 'l';

export interface LabBreadcrumbItem {
  readonly label: string;
  /** Native destination. Omit for a grouping label or the current page. */
  readonly href?: string;
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
