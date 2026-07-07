/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/popover';
import type { LabPopover } from '@labpics/ui-core/popover';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-popover>, взятые прямо из класса ядра (LabPopover). */
export type PopoverProps = Pick<LabPopover, 'placement' | 'size' | 'modal' | 'closable' | 'arrow' | 'heading' | 'description'>;

/**
 * <Popover> — тонкая Vue-обёртка над <lab-popover>.
 * События: onOpenChange.
 */
export const Popover: LabComponent<PopoverProps, 'open-change'> = createLabComponent<
  PopoverProps,
  'open-change'
>('lab-popover', {
  props: ['placement', 'size', 'modal', 'closable', 'arrow', 'heading', 'description'],
  specs: [
      { name: 'placement', attr: 'placement', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'modal', attr: 'modal', kind: 'boolean' },
      { name: 'closable', attr: 'closable', kind: 'boolean' },
      { name: 'arrow', attr: 'arrow', kind: 'boolean' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'description', attr: 'description', kind: 'string' },
  ],
  events: ['open-change'],
});
