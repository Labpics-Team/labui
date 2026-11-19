<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/menu';
  import type { LabMenu } from '@labpics/ui-core/menu';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-menu> — типы взяты прямо из класса ядра (LabMenu). */
  interface Props {
    size?: LabMenu['size'];
    placement?: LabMenu['placement'];
    disabled?: LabMenu['disabled'];
    label?: LabMenu['label'];
    items?: LabMenu['items'];
    onOpenChange?: (event: CustomEvent) => void;
    onSelect?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size, placement, disabled, label, items, onOpenChange, onSelect, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-menu', {
    specs, props: { size, placement, disabled, label, items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'open-change': onOpenChange, 'select': onSelect }));
</script>

<lab-menu bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size, placement, disabled, label, items } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-menu>
