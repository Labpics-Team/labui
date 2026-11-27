export const initialItems = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];
export const renamedItems = initialItems.map((item) =>
  item.value === 'c' ? { ...item, label: 'Renamed C' } : item,
);
