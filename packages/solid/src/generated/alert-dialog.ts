/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/alert-dialog';
import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-alert-dialog>, взятые прямо из класса ядра (LabAlertDialog). */
export type AlertDialogProps = Pick<LabAlertDialog, 'size' | 'modal' | 'closable' | 'heading' | 'description'>;

/** <AlertDialog> — тонкая Solid-обёртка над <lab-alert-dialog>. */
export const AlertDialog: LabSolidComponent<AlertDialogProps, 'open-change'> = createLabComponent<
  AlertDialogProps,
  'open-change'
>('lab-alert-dialog', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'string' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ],
  events: ['open-change'],
});
