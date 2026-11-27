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

  let { size, separator, items, maxItems, label, expandLabel, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'separator', attr: 'separator', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
    { name: 'maxItems', attr: 'max-items', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'expandLabel', attr: 'expand-label', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-breadcrumb', {
    specs, props: { size, separator, items, maxItems, label, expandLabel }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-breadcrumb bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size, separator, items, maxItems, label, expandLabel } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-breadcrumb>
