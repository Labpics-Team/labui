export type LabAlertType = 'neutral' | 'danger';
export type LabAlertAnnouncement = 'polite' | 'assertive';

/** Quantity describes visible stack depth; message storage belongs to the caller. */
export function alertQuantity(value: number): 1 | 2 | 3 {
  return Number.isFinite(value) ? (Math.min(3, Math.max(1, Math.floor(value))) as 1 | 2 | 3) : 1;
}
