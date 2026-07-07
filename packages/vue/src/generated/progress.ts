/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/progress';
import type { LabProgress } from '@labpics/ui-core/progress';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-progress>, взятые прямо из класса ядра (LabProgress). */
export type ProgressProps = Pick<LabProgress, 'size' | 'value' | 'min' | 'max' | 'label' | 'showValueText'>;

/**
 * <Progress> — тонкая Vue-обёртка над <lab-progress>.
 */
export const Progress: LabComponent<ProgressProps, never> = createLabComponent<
  ProgressProps,
  never
>('lab-progress', {
  props: ['size', 'value', 'min', 'max', 'label', 'showValueText'],
  specs: [
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'value', attr: 'value', kind: 'prop' },
      { name: 'min', attr: 'min', kind: 'string' },
      { name: 'max', attr: 'max', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'showValueText', attr: 'show-value-text', kind: 'boolean' },
  ],
  events: [],
});
