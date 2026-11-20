<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/context-menu';
  import type { LabContextMenu } from '@labpics/ui-core/context-menu';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-context-menu> — типы взяты прямо из класса ядра (LabContextMenu). */
  interface Props {
    label?: LabContextMenu['label'];
    placement?: LabContextMenu['placement'];
    disabled?: LabContextMenu['disabled'];
    checkedValues?: LabContextMenu['checkedValues'];
    defaultCheckedValues?: LabContextMenu['defaultCheckedValues'];
    heading?: LabContextMenu['heading'];
    items?: LabContextMenu['items'];
    open?: LabContextMenu['open'];
    defaultOpen?: LabContextMenu['defaultOpen'];
    onCheckedValuesChange?: (event: CustomEvent) => void;
    onOpenChange?: (event: CustomEvent) => void;
    onSelect?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { label: prop_label, placement: prop_placement, disabled: prop_disabled, checkedValues: prop_checkedValues, defaultCheckedValues: prop_defaultCheckedValues, heading: prop_heading, items: prop_items, open: prop_open, defaultOpen: prop_defaultOpen, onCheckedValuesChange, onOpenChange, onSelect, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'checkedValues', attr: 'checked-values', kind: 'prop' },
    { name: 'defaultCheckedValues', attr: 'default-checked-values', kind: 'prop' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'defaultOpen', attr: 'default-open', kind: 'boolean' },
  ];

  const server = untrack(() => renderElementParts('lab-context-menu', {
    specs, props: { label: prop_label, placement: prop_placement, disabled: prop_disabled, checkedValues: prop_checkedValues, defaultCheckedValues: prop_defaultCheckedValues, heading: prop_heading, items: prop_items, open: prop_open, defaultOpen: prop_defaultOpen }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'checked-values-change': onCheckedValuesChange, 'open-change': onOpenChange, 'select': onSelect }));
</script>

<lab-context-menu bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { label: prop_label, placement: prop_placement, disabled: prop_disabled, checkedValues: prop_checkedValues, defaultCheckedValues: prop_defaultCheckedValues, heading: prop_heading, items: prop_items, open: prop_open, defaultOpen: prop_defaultOpen } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-context-menu>
