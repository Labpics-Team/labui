<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/breadcrumb';
  import type { LabBreadcrumb } from '@labpics/ui-core/breadcrumb';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-breadcrumb> — типы взяты прямо из класса ядра (LabBreadcrumb). */
  interface Props {
    size?: LabBreadcrumb['size'];
    separator?: LabBreadcrumb['separator'];
    items?: LabBreadcrumb['items'];
    maxItems?: LabBreadcrumb['maxItems'];
    label?: LabBreadcrumb['label'];
    expandLabel?: LabBreadcrumb['expandLabel'];
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size: prop_size, separator: prop_separator, items: prop_items, maxItems: prop_maxItems, label: prop_label, expandLabel: prop_expandLabel, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'separator', attr: 'separator', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
    { name: 'maxItems', attr: 'max-items', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'expandLabel', attr: 'expand-label', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-breadcrumb', {
    specs, props: { size: prop_size, separator: prop_separator, items: prop_items, maxItems: prop_maxItems, label: prop_label, expandLabel: prop_expandLabel }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-breadcrumb bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size: prop_size, separator: prop_separator, items: prop_items, maxItems: prop_maxItems, label: prop_label, expandLabel: prop_expandLabel } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-breadcrumb>
