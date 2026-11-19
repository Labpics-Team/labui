/** One mutually exclusive mode. Values are stable identifiers; icons are decorative slots. */
export type LabSegmentedStyle = 'rounded' | 'regular' | 'sharp';
export interface LabSegmentedItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly icon?: string;
  readonly iconEnd?: string;
  readonly iconOnly?: boolean;
}

export function parseSegmentedItems(raw: string | null): readonly LabSegmentedItem[] {
  try {
    const items: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(items)) return [];
    const values = new Set<string>();
    for (const item of items) {
      if (
        !item ||
        typeof item.value !== 'string' ||
        typeof item.label !== 'string' ||
        !item.label.trim() ||
        values.has(item.value) ||
        ['disabled', 'iconOnly'].some(
          (key) => item[key] !== undefined && typeof item[key] !== 'boolean',
        ) ||
        ['icon', 'iconEnd'].some(
          (key) => item[key] !== undefined && typeof item[key] !== 'string',
        ) ||
        (item.iconOnly && !item.icon)
      )
        return [];
      values.add(item.value);
    }
    return items;
  } catch {
    return [];
  }
}
