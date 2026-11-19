/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/alert';
import type { LabAlert } from '@labpics/ui-core/alert';

/** Пропы <lab-alert>, взятые прямо из класса ядра (LabAlert). */
export type AlertProps = Pick<LabAlert, 'open' | 'controlled' | 'type' | 'quantity' | 'heading' | 'description' | 'showIcon' | 'closeLabel' | 'announcement' | 'notificationKey'>;

/** <Alert> — тонкая Solid-обёртка над <lab-alert>. */
export const Alert: LabSolidComponent<AlertProps, 'dismiss'> = createLabComponent<
  AlertProps,
  'dismiss'
>('lab-alert', {
  specs: [
    { name: 'open', attr: 'open', kind: 'prop' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'quantity', attr: 'quantity', kind: 'string' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'showIcon', attr: 'show-icon', kind: 'prop' },
    { name: 'closeLabel', attr: 'close-label', kind: 'string' },
    { name: 'announcement', attr: 'announcement', kind: 'string' },
    { name: 'notificationKey', attr: 'notification-key', kind: 'string' },
  ],
  events: ['dismiss'],
});
