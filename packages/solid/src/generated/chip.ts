/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/chip';
import type { LabChip } from '@labpics/ui-core/chip';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-chip>, взятые прямо из класса ядра (LabChip). */
export type ChipProps = Pick<LabChip, 'mode' | 'size' | 'sharp' | 'active' | 'selected' | 'defaultSelected' | 'controlled' | 'disabled' | 'loading' | 'showLeading' | 'name' | 'value'>;

/** <Chip> — тонкая Solid-обёртка над <lab-chip>. */
export const Chip: LabSolidComponent<ChipProps, 'action' | 'remove' | 'selected-change'> = createLabComponent<
  ChipProps,
  'action' | 'remove' | 'selected-change'
>('lab-chip', {
  specs: [
    { name: 'mode', attr: 'mode', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'sharp', attr: 'sharp', kind: 'boolean' },
    { name: 'active', attr: 'active', kind: 'boolean' },
    { name: 'selected', attr: 'selected', kind: 'boolean' },
    { name: 'defaultSelected', attr: 'default-selected', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'loading', attr: 'loading', kind: 'boolean' },
    { name: 'showLeading', attr: 'show-leading', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
  ],
  events: ['action', 'remove', 'selected-change'],
});
