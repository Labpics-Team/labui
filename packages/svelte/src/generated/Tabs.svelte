<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/tabs';
  import type { LabTabs } from '@labpics/ui-core/tabs';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-tabs> — типы взяты прямо из класса ядра (LabTabs). */
  interface Props {
    variant?: LabTabs['variant'];
    edge?: LabTabs['edge'];
    orientation?: LabTabs['orientation'];
    size?: LabTabs['size'];
    activationMode?: LabTabs['activationMode'];
    value?: LabTabs['value'];
    defaultValue?: LabTabs['defaultValue'];
    label?: LabTabs['label'];
    dir?: LabTabs['dir'];
    items?: LabTabs['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { variant: prop_variant, edge: prop_edge, orientation: prop_orientation, size: prop_size, activationMode: prop_activationMode, value: prop_value, defaultValue: prop_defaultValue, label: prop_label, dir: prop_dir, items: prop_items, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'edge', attr: 'edge', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'activationMode', attr: 'activation-mode', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'dir', attr: 'dir', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-tabs', {
    specs, props: { variant: prop_variant, edge: prop_edge, orientation: prop_orientation, size: prop_size, activationMode: prop_activationMode, value: prop_value, defaultValue: prop_defaultValue, label: prop_label, dir: prop_dir, items: prop_items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-tabs bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { variant: prop_variant, edge: prop_edge, orientation: prop_orientation, size: prop_size, activationMode: prop_activationMode, value: prop_value, defaultValue: prop_defaultValue, label: prop_label, dir: prop_dir, items: prop_items } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-tabs>
