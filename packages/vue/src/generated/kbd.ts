/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/kbd';
import type { LabKbd } from '@labpics/ui-core/kbd';

/** Пропы <lab-kbd>, взятые прямо из класса ядра (LabKbd). */
export type KbdProps = Pick<LabKbd, 'size' | 'keys'>;

/**
 * <Kbd> — тонкая Vue-обёртка над <lab-kbd>.
 */
export const Kbd: LabComponent<KbdProps, never> = createLabComponent<
  KbdProps,
  never
>('lab-kbd', {
  specs: [
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'keys', attr: 'keys', kind: 'prop' },
  ],
  events: [],
});
