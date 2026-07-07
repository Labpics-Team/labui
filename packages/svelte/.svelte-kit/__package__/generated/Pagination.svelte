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
    size?: LabPagination['size'];
    count?: LabPagination['count'];
    pageSize?: LabPagination['pageSize'];
    siblingCount?: LabPagination['siblingCount'];
    page?: LabPagination['page'];
    defaultPage?: LabPagination['defaultPage'];
    onPageChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, count, pageSize, siblingCount, page, defaultPage, onPageChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'count', attr: 'count', kind: 'string' },
    { name: 'pageSize', attr: 'page-size', kind: 'string' },
    { name: 'siblingCount', attr: 'sibling-count', kind: 'string' },
    { name: 'page', attr: 'page', kind: 'string' },
    { name: 'defaultPage', attr: 'default-page', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, count, pageSize, siblingCount, page, defaultPage });
  });
  $effect(() => forwardEvents(el, { 'page-change': onPageChange }));
</script>

<lab-pagination bind:this={el} {...rest}>
</lab-pagination>
