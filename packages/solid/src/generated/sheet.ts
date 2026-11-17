/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/sheet';
import type { LabSheet } from '@labpics/ui-core/sheet';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-sheet>, взятые прямо из класса ядра (LabSheet). */
export type SheetProps = Pick<LabSheet, 'open' | 'position' | 'modal' | 'closable' | 'heading' | 'description'>;

/** <Sheet> — тонкая Solid-обёртка над <lab-sheet>. */
export const Sheet: LabSolidComponent<SheetProps, 'motion-error' | 'open-change' | 'position-change'> = createLabComponent<
  SheetProps,
  'motion-error' | 'open-change' | 'position-change'
>('lab-sheet', {
  specs: [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'position', attr: 'position', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ],
  events: ['motion-error', 'open-change', 'position-change'],
});
