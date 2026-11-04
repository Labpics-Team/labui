/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/sheet';
import type { LabSheet } from '@labpics/ui-core/sheet';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-sheet>, взятые прямо из класса ядра (LabSheet). */
export type SheetProps = Pick<LabSheet, 'modal' | 'closable' | 'heading' | 'description' | 'open' | 'position'>;

/**
 * <Sheet> — тонкая Vue-обёртка над <lab-sheet>.
 * События: onMotionError, onOpenChange, onPositionChange.
 */
export const Sheet: LabComponent<SheetProps, 'motion-error' | 'open-change' | 'position-change'> = createLabComponent<
  SheetProps,
  'motion-error' | 'open-change' | 'position-change'
>('lab-sheet', {
  specs: [
      { name: 'modal', attr: 'modal', kind: 'string' },
      { name: 'closable', attr: 'closable', kind: 'boolean' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'description', attr: 'description', kind: 'string' },
      { name: 'open', attr: 'open', kind: 'boolean' },
      { name: 'position', attr: 'position', kind: 'prop' },
  ],
  events: ['motion-error', 'open-change', 'position-change'],
});
