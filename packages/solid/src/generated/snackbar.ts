/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/snackbar';
import type { LabSnackbar } from '@labpics/ui-core/snackbar';

/** Пропы <lab-snackbar>, взятые прямо из класса ядра (LabSnackbar). */
export type SnackbarProps = Pick<LabSnackbar, 'open' | 'message' | 'duration' | 'actionLabel' | 'notificationKey'>;

/** <Snackbar> — тонкая Solid-обёртка над <lab-snackbar>. */
export const Snackbar: LabSolidComponent<SnackbarProps, 'lab-action' | 'lab-error' | 'lab-open-change'> = createLabComponent<
  SnackbarProps,
  'lab-action' | 'lab-error' | 'lab-open-change'
>('lab-snackbar', {
  specs: [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'message', attr: 'message', kind: 'string' },
    { name: 'duration', attr: 'duration', kind: 'string' },
    { name: 'actionLabel', attr: 'action-label', kind: 'string' },
    { name: 'notificationKey', attr: 'notification-key', kind: 'string' },
  ],
  events: ['lab-action', 'lab-error', 'lab-open-change'],
});
