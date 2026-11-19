/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/icon';
import type { LabIcon } from '@labpics/ui-core/icon';

/** Пропы <lab-icon>, взятые прямо из класса ядра (LabIcon). */
export type IconProps = Pick<LabIcon, 'symbol' | 'variant' | 'size' | 'scale' | 'weight' | 'opsz' | 'state' | 'date' | 'timeZone' | 'duration' | 'reducedMotion' | 'effect' | 'effectKey' | 'label'>;

/** <Icon> — тонкая Solid-обёртка над <lab-icon>. */
export const Icon: LabSolidComponent<IconProps, never> = createLabComponent<
  IconProps,
  never
>('lab-icon', {
  specs: [
    { name: 'symbol', attr: 'symbol', kind: 'prop' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'prop' },
    { name: 'scale', attr: 'scale', kind: 'prop' },
    { name: 'weight', attr: 'weight', kind: 'string' },
    { name: 'opsz', attr: 'opsz', kind: 'prop' },
    { name: 'state', attr: 'state', kind: 'string' },
    { name: 'date', attr: 'date', kind: 'prop' },
    { name: 'timeZone', attr: 'time-zone', kind: 'string' },
    { name: 'duration', attr: 'duration', kind: 'string' },
    { name: 'reducedMotion', attr: 'reduced-motion', kind: 'boolean' },
    { name: 'effect', attr: 'effect', kind: 'string' },
    { name: 'effectKey', attr: 'effectKey', kind: 'prop' },
    { name: 'label', attr: 'label', kind: 'string' },
  ],
  events: [],
});
