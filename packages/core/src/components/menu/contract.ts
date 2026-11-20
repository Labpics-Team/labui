import type { IconSymbol, IconVariant } from '@labpics/icons/render';

export type LabMenuTone = 'neutral' | 'accent' | 'danger';
export type LabMenuPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

interface MenuLabel {
  /** Stable identity across reordering and within the complete menu tree. */
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly type?: LabMenuTone;
  /** Leading icon; checked check/radio entries display the selection mark in its place. */
  readonly icon?: IconSymbol;
  readonly iconVariant?: IconVariant;
  readonly iconEnd?: IconSymbol;
  readonly iconEndVariant?: IconVariant;
  readonly shortcut?: readonly string[];
}

export type LabMenuItem =
  | (MenuLabel & { readonly kind?: 'action'; readonly closeOnSelect?: boolean })
  | (MenuLabel & { readonly kind: 'check'; readonly closeOnSelect?: boolean })
  | (MenuLabel & {
      readonly kind: 'radio';
      readonly group: string;
      readonly closeOnSelect?: boolean;
    })
  | (MenuLabel & { readonly kind: 'submenu'; readonly items: readonly LabMenuItem[] })
  | { readonly kind: 'separator'; readonly value: string };

export interface LabMenubarItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly heading?: string;
  readonly items: readonly LabMenuItem[];
}

export interface MenuPanel {
  readonly key: string;
  readonly parent?: string;
  readonly triggerValue?: string;
  readonly label: string;
  readonly heading?: string;
  readonly items: readonly LabMenuItem[];
}

export interface MenuModel {
  readonly panels: readonly MenuPanel[];
  readonly items: ReadonlyMap<string, LabMenuItem>;
  readonly panelByItem: ReadonlyMap<string, string>;
  readonly roots: readonly LabMenubarItem[];
}

/** One validated tree drives renderers, navigation services and checked state. */
export function menuModel(
  items: readonly LabMenuItem[],
  label = 'Menu',
  heading?: string,
  roots?: readonly LabMenubarItem[],
): MenuModel {
  const panels: MenuPanel[] = [];
  const byValue = new Map<string, LabMenuItem>();
  const panelByItem = new Map<string, string>();
  const visit = (panel: MenuPanel): void => {
    if (!Array.isArray(panel.items)) throw new TypeError('Menu items must be an array');
    panels.push(panel);
    for (const item of panel.items) {
      if (!item || typeof item.value !== 'string' || !item.value || byValue.has(item.value))
        throw new TypeError('Every menu item needs a unique, nonempty value');
      const kind = item.kind ?? 'action';
      if (!['action', 'check', 'radio', 'separator', 'submenu'].includes(kind))
        throw new TypeError(`Unknown menu item kind: ${kind}`);
      if (
        kind !== 'separator' &&
        (!('label' in item) || typeof item.label !== 'string' || !item.label.trim())
      )
        throw new TypeError(`Menu item ${item.value} needs a label`);
      if (item.kind === 'radio' && (typeof item.group !== 'string' || !item.group))
        throw new TypeError(`Radio menu item ${item.value} needs a group`);
      byValue.set(item.value, item);
      panelByItem.set(item.value, panel.key);
      if (item.kind === 'submenu')
        visit({
          key: `submenu:${item.value}`,
          parent: panel.key,
          triggerValue: item.value,
          label: item.label,
          items: item.items,
        });
    }
  };
  const rootValues = new Set<string>();
  for (const root of roots ?? []) {
    if (!root.value || rootValues.has(root.value) || !root.label.trim())
      throw new TypeError('Every menubar entry needs a unique value and a label');
    rootValues.add(root.value);
    visit({
      key: `root:${root.value}`,
      triggerValue: root.value,
      label: root.label,
      heading: root.heading,
      items: root.items,
    });
  }
  if (!roots) visit({ key: 'root', label, heading, items });
  return { panels, items: byValue, panelByItem, roots: roots ?? [] };
}

/** Unknown/stale values disappear; each radio group has at most one selection. */
export function menuCheckedValues(model: MenuModel, values: readonly string[]): readonly string[] {
  const groups = new Set<string>();
  const selected = new Set<string>();
  for (const value of values) {
    const item = model.items.get(value);
    if (!item || (item.kind !== 'check' && item.kind !== 'radio')) continue;
    if (item.kind === 'radio') {
      if (groups.has(item.group)) continue;
      groups.add(item.group);
    }
    selected.add(value);
  }
  return [...selected];
}

export function changeMenuChecked(
  model: MenuModel,
  current: readonly string[],
  value: string,
  checked: boolean,
): readonly string[] {
  const item = model.items.get(value);
  const values = menuCheckedValues(model, current);
  if (
    !item ||
    item.kind === 'separator' ||
    item.disabled ||
    (item.kind !== 'check' && item.kind !== 'radio')
  )
    return values;
  if (item.kind === 'radio' && !checked) return values;
  const remaining = values.filter((other) => {
    if (other === value) return false;
    const previous = model.items.get(other);
    return item.kind !== 'radio' || previous?.kind !== 'radio' || previous.group !== item.group;
  });
  return checked ? [...remaining, value] : remaining;
}

export const menuItemsConverter = {
  fromAttribute(value: string | null): readonly LabMenuItem[] {
    if (!value) return [];
    const items = JSON.parse(value) as readonly LabMenuItem[];
    menuModel(items);
    return items;
  },
};
