/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/switch';
import type { LabSwitch } from '@labpics/ui-core/switch';

/** Пропы <lab-switch>, взятые прямо из класса ядра (LabSwitch). */
export type SwitchProps = Pick<LabSwitch, 'type' | 'size' | 'checked' | 'defaultChecked' | 'controlled' | 'disabled' | 'required' | 'icon' | 'name' | 'value'>;

/**
 * <Switch> — тонкая Vue-обёртка над <lab-switch>.
 * События: onCheckedChange.
 */
export const Switch: LabComponent<SwitchProps, 'checked-change'> = createLabComponent<
  SwitchProps,
  'checked-change'
>('lab-switch', {
  specs: [
      { name: 'type', attr: 'type', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'checked', attr: 'checked', kind: 'boolean' },
      { name: 'defaultChecked', attr: 'default-checked', kind: 'boolean' },
      { name: 'controlled', attr: 'controlled', kind: 'boolean' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'icon', attr: 'icon', kind: 'boolean' },
      { name: 'name', attr: 'name', kind: 'string' },
      { name: 'value', attr: 'value', kind: 'string' },
  ],
  events: ['checked-change'],
});
