/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/tooltip';
import type { LabTooltip } from '@labpics/ui-core/tooltip';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-tooltip>, взятые прямо из класса ядра (LabTooltip). */
export type TooltipProps = Pick<LabTooltip, 'placement' | 'size' | 'content' | 'openDelay' | 'closeDelay' | 'disabled' | 'arrow'>;

/**
 * <Tooltip> — тонкая Vue-обёртка над <lab-tooltip>.
 * События: onOpenChange.
 */
export const Tooltip: LabComponent<TooltipProps, 'open-change'> = createLabComponent<
  TooltipProps,
  'open-change'
>('lab-tooltip', {
  specs: [
      { name: 'placement', attr: 'placement', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'content', attr: 'content', kind: 'string' },
      { name: 'openDelay', attr: 'open-delay', kind: 'string' },
      { name: 'closeDelay', attr: 'close-delay', kind: 'string' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'arrow', attr: 'arrow', kind: 'boolean' },
  ],
  events: ['open-change'],
});
