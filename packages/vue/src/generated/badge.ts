/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/badge';
import type { LabBadge } from '@labpics/ui-core/badge';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-badge>, взятые прямо из класса ядра (LabBadge). */
export type BadgeProps = Pick<LabBadge, 'color' | 'type' | 'disabled'>;

/**
 * <Badge> — тонкая Vue-обёртка над <lab-badge>.
 */
export const Badge: LabComponent<BadgeProps, never> = createLabComponent<
  BadgeProps,
  never
>('lab-badge', {
  specs: [
      { name: 'color', attr: 'color', kind: 'string' },
      { name: 'type', attr: 'type', kind: 'string' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
  ],
  events: [],
  fillSlots: ['dot', 'leading', 'trailing'],
});
