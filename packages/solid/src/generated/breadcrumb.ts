/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumb } from '@labpics/ui-core/breadcrumb';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-breadcrumb>, взятые прямо из класса ядра (LabBreadcrumb). */
export type BreadcrumbProps = Pick<LabBreadcrumb, 'size' | 'separator' | 'items'>;

/** <Breadcrumb> — тонкая Solid-обёртка над <lab-breadcrumb>. */
export const Breadcrumb: LabSolidComponent<BreadcrumbProps, never> = createLabComponent<
  BreadcrumbProps,
  never
>('lab-breadcrumb', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'separator', attr: 'separator', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: [],
});
