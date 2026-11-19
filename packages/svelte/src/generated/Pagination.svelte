<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/pagination';
  import type { LabPagination } from '@labpics/ui-core/pagination';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

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
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { count: prop_count, pageSize: prop_pageSize, page: prop_page, defaultPage: prop_defaultPage, siblingCount: prop_siblingCount, variant: prop_variant, disabled: prop_disabled, ambient: prop_ambient, progress: prop_progress, href: prop_href, label: prop_label, previousLabel: prop_previousLabel, nextLabel: prop_nextLabel, pageLabel: prop_pageLabel, onPageChange, children, slots, ...rest }: Props = $props();

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

  const server = untrack(() => renderElementParts('lab-pagination', {
    specs, props: { count: prop_count, pageSize: prop_pageSize, page: prop_page, defaultPage: prop_defaultPage, siblingCount: prop_siblingCount, variant: prop_variant, disabled: prop_disabled, ambient: prop_ambient, progress: prop_progress, href: prop_href, label: prop_label, previousLabel: prop_previousLabel, nextLabel: prop_nextLabel, pageLabel: prop_pageLabel }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'page-change': onPageChange }));
</script>

<lab-pagination bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { count: prop_count, pageSize: prop_pageSize, page: prop_page, defaultPage: prop_defaultPage, siblingCount: prop_siblingCount, variant: prop_variant, disabled: prop_disabled, ambient: prop_ambient, progress: prop_progress, href: prop_href, label: prop_label, previousLabel: prop_previousLabel, nextLabel: prop_nextLabel, pageLabel: prop_pageLabel } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-pagination>
