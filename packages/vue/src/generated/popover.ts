/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/popover';
import type { LabPopover } from '@labpics/ui-core/popover';

/** Пропы <lab-popover>, взятые прямо из класса ядра (LabPopover). */
export type PopoverProps = Pick<LabPopover, 'open' | 'controlled' | 'size' | 'modal' | 'closable' | 'heading' | 'description' | 'closeLabel' | 'placement' | 'arrow'>;

/**
 * <Popover> — тонкая Vue-обёртка над <lab-popover>.
 * События: onOpenChange.
 */
export const Popover: LabComponent<PopoverProps, 'open-change'> = createLabComponent<
  PopoverProps,
  'open-change'
>('lab-popover', {
  specs: [
      { name: 'open', attr: 'open', kind: 'boolean' },
      { name: 'controlled', attr: 'controlled', kind: 'boolean' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'modal', attr: 'modal', kind: 'prop' },
      { name: 'closable', attr: 'closable', kind: 'prop' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'description', attr: 'description', kind: 'string' },
      { name: 'closeLabel', attr: 'close-label', kind: 'string' },
      { name: 'placement', attr: 'placement', kind: 'string' },
      { name: 'arrow', attr: 'arrow', kind: 'prop' },
  ],
  events: ['open-change'],
});
