<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/segmented-control';
  import type { LabSegmentedControl } from '@labpics/ui-core/segmented-control';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-segmented-control> — типы взяты прямо из класса ядра (LabSegmentedControl). */
  interface Props {
    shape?: LabSegmentedControl['shape'];
    value?: LabSegmentedControl['value'];
    defaultValue?: LabSegmentedControl['defaultValue'];
    name?: LabSegmentedControl['name'];
    label?: LabSegmentedControl['label'];
    dir?: LabSegmentedControl['dir'];
    disabled?: LabSegmentedControl['disabled'];
    required?: LabSegmentedControl['required'];
    items?: LabSegmentedControl['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { shape: prop_shape, value: prop_value, defaultValue: prop_defaultValue, name: prop_name, label: prop_label, dir: prop_dir, disabled: prop_disabled, required: prop_required, items: prop_items, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'shape', attr: 'shape', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'dir', attr: 'dir', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-segmented-control', {
    specs, props: { shape: prop_shape, value: prop_value, defaultValue: prop_defaultValue, name: prop_name, label: prop_label, dir: prop_dir, disabled: prop_disabled, required: prop_required, items: prop_items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-segmented-control bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { shape: prop_shape, value: prop_value, defaultValue: prop_defaultValue, name: prop_name, label: prop_label, dir: prop_dir, disabled: prop_disabled, required: prop_required, items: prop_items } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-segmented-control>
