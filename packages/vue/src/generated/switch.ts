/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/switch';
import type { LabSwitch } from '@labpics/ui-core/switch';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-switch>, взятые прямо из класса ядра (LabSwitch). */
export type SwitchProps = Pick<LabSwitch, 'type' | 'size' | 'checked' | 'defaultChecked' | 'disabled' | 'name' | 'labelStart' | 'hideLabelStart' | 'hideLabelEnd'>;

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
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'name', attr: 'name', kind: 'string' },
      { name: 'labelStart', attr: 'label-start', kind: 'string' },
      { name: 'hideLabelStart', attr: 'hide-label-start', kind: 'boolean' },
      { name: 'hideLabelEnd', attr: 'hide-label-end', kind: 'boolean' },
  ],
  events: ['checked-change'],
});
