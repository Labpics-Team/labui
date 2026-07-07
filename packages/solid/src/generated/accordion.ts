/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/accordion';
import type { LabAccordion } from '@labpics/ui-core/accordion';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-accordion>, взятые прямо из класса ядра (LabAccordion). */
export type AccordionProps = Pick<LabAccordion, 'orientation' | 'size' | 'multiple' | 'collapsible' | 'disabled' | 'value' | 'defaultValue' | 'items'>;

/** <Accordion> — тонкая Solid-обёртка над <lab-accordion>. */
export const Accordion: LabSolidComponent<AccordionProps, 'value-change'> = createLabComponent<
  AccordionProps,
  'value-change'
>('lab-accordion', {
  specs: [
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'collapsible', attr: 'collapsible', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['value-change'],
});
