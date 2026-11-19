/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';

/** Пропы <lab-card>, взятые прямо из класса ядра (LabCard). */
export type CardProps = Pick<LabCard, 'variant' | 'padding' | 'interactive' | 'image' | 'imageAlt' | 'heading' | 'headingHint' | 'description' | 'caption' | 'lowerCaption'>;

/** <Card> — тонкая Solid-обёртка над <lab-card>. */
export const Card: LabSolidComponent<CardProps, never> = createLabComponent<
  CardProps,
  never
>('lab-card', {
  specs: [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'padding', attr: 'padding', kind: 'string' },
    { name: 'interactive', attr: 'interactive', kind: 'boolean' },
    { name: 'image', attr: 'image', kind: 'string' },
    { name: 'imageAlt', attr: 'image-alt', kind: 'string' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'headingHint', attr: 'heading-hint', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'caption', attr: 'caption', kind: 'string' },
    { name: 'lowerCaption', attr: 'lower-caption', kind: 'string' },
  ],
  events: [],
});
