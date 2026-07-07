/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/dialog';
import type { LabDialog } from '@labpics/ui-core/dialog';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-dialog>, взятые прямо из класса ядра (LabDialog). */
export type DialogProps = Pick<LabDialog, 'size' | 'modal' | 'closable' | 'heading' | 'description'>;

/**
 * <Dialog> — тонкая Vue-обёртка над <lab-dialog>.
 * События: onOpenChange.
 */
export const Dialog: LabComponent<DialogProps, 'open-change'> = createLabComponent<
  DialogProps,
  'open-change'
>('lab-dialog', {
  props: ['size', 'modal', 'closable', 'heading', 'description'],
  specs: [
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'modal', attr: 'modal', kind: 'string' },
      { name: 'closable', attr: 'closable', kind: 'boolean' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'description', attr: 'description', kind: 'string' },
  ],
  events: ['open-change'],
});
