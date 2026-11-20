/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/menu';
import type { LabMenu } from '@labpics/ui-core/menu';

/** Пропы <lab-menu>, взятые прямо из класса ядра (LabMenu). */
export type MenuProps = Pick<LabMenu, 'label' | 'placement' | 'disabled' | 'checkedValues' | 'defaultCheckedValues' | 'heading' | 'items' | 'open' | 'defaultOpen'>;

/**
 * <Menu> — тонкая Vue-обёртка над <lab-menu>.
 * События: onCheckedValuesChange, onOpenChange, onSelect.
 */
export const Menu: LabComponent<MenuProps, 'checked-values-change' | 'open-change' | 'select'> = createLabComponent<
  MenuProps,
  'checked-values-change' | 'open-change' | 'select'
>('lab-menu', {
  specs: [
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'placement', attr: 'placement', kind: 'string' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'checkedValues', attr: 'checked-values', kind: 'prop' },
      { name: 'defaultCheckedValues', attr: 'default-checked-values', kind: 'prop' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'items', attr: 'items', kind: 'prop' },
      { name: 'open', attr: 'open', kind: 'boolean' },
      { name: 'defaultOpen', attr: 'default-open', kind: 'boolean' },
  ],
  events: ['checked-values-change', 'open-change', 'select'],
});
