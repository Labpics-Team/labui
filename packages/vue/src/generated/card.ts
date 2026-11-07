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
export type CardProps = Pick<LabCard, 'variant' | 'padding' | 'interactive' | 'imageSrc' | 'imageAlt' | 'heading' | 'headingLevel' | 'caption' | 'description' | 'lowerCaption' | 'titleHint' | 'badge'>;

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
      { name: 'imageSrc', attr: 'image-src', kind: 'string' },
      { name: 'imageAlt', attr: 'image-alt', kind: 'string' },
      { name: 'heading', attr: 'heading', kind: 'string' },
      { name: 'headingLevel', attr: 'heading-level', kind: 'string' },
      { name: 'caption', attr: 'caption', kind: 'string' },
      { name: 'description', attr: 'description', kind: 'string' },
      { name: 'lowerCaption', attr: 'lower-caption', kind: 'string' },
      { name: 'titleHint', attr: 'title-hint', kind: 'string' },
      { name: 'badge', attr: 'badge', kind: 'string' },
  ],
  events: [],
});
