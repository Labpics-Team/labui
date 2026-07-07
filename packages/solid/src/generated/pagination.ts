/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/pagination';
import type { LabPagination } from '@labpics/ui-core/pagination';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-pagination>, взятые прямо из класса ядра (LabPagination). */
export type PaginationProps = Pick<LabPagination, 'size' | 'count' | 'pageSize' | 'siblingCount' | 'page' | 'defaultPage'>;

/** <Pagination> — тонкая Solid-обёртка над <lab-pagination>. */
export const Pagination: LabSolidComponent<PaginationProps, 'page-change'> = createLabComponent<
  PaginationProps,
  'page-change'
>('lab-pagination', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'count', attr: 'count', kind: 'string' },
    { name: 'pageSize', attr: 'page-size', kind: 'string' },
    { name: 'siblingCount', attr: 'sibling-count', kind: 'string' },
    { name: 'page', attr: 'page', kind: 'string' },
    { name: 'defaultPage', attr: 'default-page', kind: 'string' },
  ],
  events: ['page-change'],
});
