import { paginationProfile as p } from '@labpics/ui-tokens';

export type LabPaginationVariant = 'numbered' | 'compact';
export interface LabPageChangeDetails {
  page: number;
  pageSize: number;
}

/** Reject non-finite values before they reach range allocation or navigation. */
export function paginationCount(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function paginationPageSize(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 10;
}
export function paginationPage(value: number | undefined, total: number): number {
  return Math.min(Math.max(1, total), Number.isSafeInteger(value) ? Math.max(1, value ?? 1) : 1);
}
export function paginationSiblings(value: number): number {
  return Number.isSafeInteger(value)
    ? Math.max(0, Math.min(p.maxSiblingCount, value))
    : p.defaultSiblingCount;
}
export function paginationProgress(value: number | undefined): number | undefined {
  return value === undefined
    ? undefined
    : Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : 0;
}
export function paginationHref(
  template: string,
  page: number,
  pageSize: number,
): string | undefined {
  return template
    ? template.replaceAll('{page}', String(page)).replaceAll('{pageSize}', String(pageSize))
    : undefined;
}
/** A moving five-dot window; smaller edge dots indicate pages outside it. */
export function compactPages(page: number, total: number): number[] {
  const length = Math.min(p.compact.visiblePages, total);
  const first = Math.max(1, Math.min(page - Math.floor(length / 2), total - length + 1));
  return Array.from({ length }, (_, i) => first + i);
}
export function paginationKeyPage(
  key: string,
  page: number,
  total: number,
  rtl: boolean,
): number | undefined {
  const next =
    key === 'Home'
      ? 1
      : key === 'End'
        ? total
        : key === 'ArrowRight'
          ? page + (rtl ? -1 : 1)
          : key === 'ArrowLeft'
            ? page + (rtl ? 1 : -1)
            : undefined;
  return next === undefined || total === 0 ? undefined : paginationPage(next, total);
}
