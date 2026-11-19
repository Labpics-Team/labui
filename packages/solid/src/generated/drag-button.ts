/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/drag-button';
import type { LabDragButton } from '@labpics/ui-core/drag-button';

/** Пропы <lab-drag-button>, взятые прямо из класса ядра (LabDragButton). */
export type DragButtonProps = Pick<LabDragButton, 'label' | 'helperText' | 'showHelper' | 'pendingText' | 'successText' | 'dangerText' | 'status' | 'disabled' | 'resetKey'>;

/** <DragButton> — тонкая Solid-обёртка над <lab-drag-button>. */
export const DragButton: LabSolidComponent<DragButtonProps, 'complete'> = createLabComponent<
  DragButtonProps,
  'complete'
>('lab-drag-button', {
  specs: [
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'helperText', attr: 'helper-text', kind: 'string' },
    { name: 'showHelper', attr: 'show-helper', kind: 'boolean' },
    { name: 'pendingText', attr: 'pending-text', kind: 'string' },
    { name: 'successText', attr: 'success-text', kind: 'string' },
    { name: 'dangerText', attr: 'danger-text', kind: 'string' },
    { name: 'status', attr: 'status', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'resetKey', attr: 'reset-key', kind: 'string' },
  ],
  events: ['complete'],
});
