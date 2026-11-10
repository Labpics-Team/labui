/** Общая модель пункта для фильтра и обоих рендереров. */
export interface LabComboboxItem {
  /** Уникальное значение выбранного пункта. */
  readonly value: string;
  /** Видимая подпись пункта и значение текстового поля после выбора. */
  readonly label: string;
  /** Недоступность этого пункта независимо от состояния всего поля. */
  readonly disabled?: boolean;
}

/** Общий фильтр не загружает рендерер и не регистрирует custom element. */
export function filterComboboxItems(
  items: readonly LabComboboxItem[],
  query: string,
): LabComboboxItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...items];
  return items.filter((item) => item.label.toLowerCase().includes(q));
}
