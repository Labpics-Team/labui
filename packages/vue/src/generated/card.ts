/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-card>, взятые прямо из класса ядра (LabCard). */
export type CardProps = Pick<LabCard, 'variant' | 'padding' | 'interactive'>;

/**
 * <Card> — тонкая Vue-обёртка над <lab-card>.
 */
export const Card: LabComponent<CardProps, never> = createLabComponent<
  CardProps,
  never
>('lab-card', {
  specs: [
      { name: 'variant', attr: 'variant', kind: 'string' },
      { name: 'padding', attr: 'padding', kind: 'string' },
      { name: 'interactive', attr: 'interactive', kind: 'boolean' },
  ],
  events: [],
});
