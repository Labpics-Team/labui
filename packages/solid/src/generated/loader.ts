/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/loader';
import type { LabLoader } from '@labpics/ui-core/loader';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-loader>, взятые прямо из класса ядра (LabLoader). */
export type LoaderProps = Pick<LabLoader, 'size' | 'label'>;

/** <Loader> — тонкая Solid-обёртка над <lab-loader>. */
export const Loader: LabSolidComponent<LoaderProps, never> = createLabComponent<
  LoaderProps,
  never
>('lab-loader', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
  ],
  events: [],
});
