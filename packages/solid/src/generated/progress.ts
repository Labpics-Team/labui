/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/progress';
import type { LabProgress } from '@labpics/ui-core/progress';

/** Пропы <lab-progress>, взятые прямо из класса ядра (LabProgress). */
export type ProgressProps = Pick<LabProgress, 'size' | 'variant' | 'value' | 'min' | 'max' | 'label' | 'showValueText'>;

/** <Progress> — тонкая Solid-обёртка над <lab-progress>. */
export const Progress: LabSolidComponent<ProgressProps, never> = createLabComponent<
  ProgressProps,
  never
>('lab-progress', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'showValueText', attr: 'show-value-text', kind: 'boolean' },
  ],
  events: [],
});
