import type { LabComboboxItem } from './lab-combobox.js';
export function filterComboboxItems(
  items: readonly LabComboboxItem[],
  query: string,
): LabComboboxItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...items];
  return items.filter((item) => item.label.toLowerCase().includes(q));
}
