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
export type PaginationProps = Pick<LabPagination, 'count' | 'pageSize' | 'page' | 'defaultPage' | 'siblingCount' | 'variant' | 'disabled' | 'ambient' | 'progress' | 'href' | 'label' | 'previousLabel' | 'nextLabel' | 'pageLabel'>;

/** <Pagination> — тонкая Solid-обёртка над <lab-pagination>. */
export const Pagination: LabSolidComponent<PaginationProps, 'page-change'> = createLabComponent<
  PaginationProps,
  'page-change'
>('lab-pagination', {
  specs: [
    { name: 'count', attr: 'count', kind: 'string' },
    { name: 'pageSize', attr: 'page-size', kind: 'string' },
    { name: 'page', attr: 'page', kind: 'prop' },
    { name: 'defaultPage', attr: 'default-page', kind: 'string' },
    { name: 'siblingCount', attr: 'sibling-count', kind: 'string' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'ambient', attr: 'ambient', kind: 'boolean' },
    { name: 'progress', attr: 'progress', kind: 'prop' },
    { name: 'href', attr: 'href', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'previousLabel', attr: 'previous-label', kind: 'string' },
    { name: 'nextLabel', attr: 'next-label', kind: 'string' },
    { name: 'pageLabel', attr: 'page-label', kind: 'string' },
  ],
  events: ['page-change'],
});
