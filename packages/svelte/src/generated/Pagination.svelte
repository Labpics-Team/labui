<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/pagination';
  import type { LabPagination } from '@labpics/ui-core/pagination';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-pagination> — типы взяты прямо из класса ядра (LabPagination). */
  interface Props {
    count?: LabPagination['count'];
    pageSize?: LabPagination['pageSize'];
    page?: LabPagination['page'];
    defaultPage?: LabPagination['defaultPage'];
    siblingCount?: LabPagination['siblingCount'];
    variant?: LabPagination['variant'];
    disabled?: LabPagination['disabled'];
    ambient?: LabPagination['ambient'];
    progress?: LabPagination['progress'];
    href?: LabPagination['href'];
    label?: LabPagination['label'];
    previousLabel?: LabPagination['previousLabel'];
    nextLabel?: LabPagination['nextLabel'];
    pageLabel?: LabPagination['pageLabel'];
    onPageChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { count, pageSize, page, defaultPage, siblingCount, variant, disabled, ambient, progress, href, label, previousLabel, nextLabel, pageLabel, onPageChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
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
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { count, pageSize, page, defaultPage, siblingCount, variant, disabled, ambient, progress, href, label, previousLabel, nextLabel, pageLabel });
  });
  $effect(() => forwardEvents(el, { 'page-change': onPageChange }));
</script>

<lab-pagination bind:this={el} {...rest}>
</lab-pagination>
