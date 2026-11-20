/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/menubar';
import type { LabMenubar } from '@labpics/ui-core/menubar';

/** Пропы <lab-menubar>, взятые прямо из класса ядра (LabMenubar). */
export type MenubarProps = Pick<LabMenubar, 'label' | 'placement' | 'disabled' | 'checkedValues' | 'defaultCheckedValues' | 'menus' | 'value' | 'defaultValue'>;

/**
 * <Menubar> — тонкая Vue-обёртка над <lab-menubar>.
 * События: onCheckedValuesChange, onSelect, onValueChange.
 */
export const Menubar: LabComponent<MenubarProps, 'checked-values-change' | 'select' | 'value-change'> = createLabComponent<
  MenubarProps,
  'checked-values-change' | 'select' | 'value-change'
>('lab-menubar', {
  specs: [
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'placement', attr: 'placement', kind: 'string' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'checkedValues', attr: 'checked-values', kind: 'prop' },
      { name: 'defaultCheckedValues', attr: 'default-checked-values', kind: 'prop' },
      { name: 'menus', attr: 'menus', kind: 'prop' },
      { name: 'value', attr: 'value', kind: 'string' },
      { name: 'defaultValue', attr: 'default-value', kind: 'string' },
  ],
  events: ['checked-values-change', 'select', 'value-change'],
});
