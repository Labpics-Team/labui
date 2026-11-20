/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/alert-dialog';
import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';

/** Пропы <lab-alert-dialog>, взятые прямо из класса ядра (LabAlertDialog). */
export type AlertDialogProps = Pick<LabAlertDialog, 'open' | 'controlled' | 'size' | 'modal' | 'closable' | 'heading' | 'description' | 'closeLabel' | 'confirmLabel' | 'cancelLabel' | 'pending'>;

/**
 * <AlertDialog> — тонкая Vue-обёртка над <lab-alert-dialog>.
 * События: onCancel, onConfirm, onOpenChange.
 */
export const AlertDialog: LabComponent<AlertDialogProps, 'cancel' | 'confirm' | 'open-change'> = createLabComponent<
  AlertDialogProps,
  'cancel' | 'confirm' | 'open-change'
>('lab-alert-dialog', {
  specs: [
      { name: 'open', attr: 'open', kind: 'boolean' },
      { name: 'controlled', attr: 'controlled', kind: 'boolean' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'modal', attr: 'modal', kind: 'prop' },
      { name: 'closable', attr: 'closable', kind: 'prop' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'description', attr: 'description', kind: 'string' },
      { name: 'closeLabel', attr: 'close-label', kind: 'string' },
      { name: 'confirmLabel', attr: 'confirm-label', kind: 'string' },
      { name: 'cancelLabel', attr: 'cancel-label', kind: 'string' },
      { name: 'pending', attr: 'pending', kind: 'boolean' },
  ],
  events: ['cancel', 'confirm', 'open-change'],
});
