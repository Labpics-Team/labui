<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/menubar';
  import type { LabMenubar } from '@labpics/ui-core/menubar';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-menubar> — типы взяты прямо из класса ядра (LabMenubar). */
  interface Props {
    label?: LabMenubar['label'];
    placement?: LabMenubar['placement'];
    disabled?: LabMenubar['disabled'];
    checkedValues?: LabMenubar['checkedValues'];
    defaultCheckedValues?: LabMenubar['defaultCheckedValues'];
    menus?: LabMenubar['menus'];
    value?: LabMenubar['value'];
    defaultValue?: LabMenubar['defaultValue'];
    onCheckedValuesChange?: (event: CustomEvent) => void;
    onSelect?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { label: prop_label, placement: prop_placement, disabled: prop_disabled, checkedValues: prop_checkedValues, defaultCheckedValues: prop_defaultCheckedValues, menus: prop_menus, value: prop_value, defaultValue: prop_defaultValue, onCheckedValuesChange, onSelect, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'checkedValues', attr: 'checked-values', kind: 'prop' },
    { name: 'defaultCheckedValues', attr: 'default-checked-values', kind: 'prop' },
    { name: 'menus', attr: 'menus', kind: 'prop' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-menubar', {
    specs, props: { label: prop_label, placement: prop_placement, disabled: prop_disabled, checkedValues: prop_checkedValues, defaultCheckedValues: prop_defaultCheckedValues, menus: prop_menus, value: prop_value, defaultValue: prop_defaultValue }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'checked-values-change': onCheckedValuesChange, 'select': onSelect, 'value-change': onValueChange }));
</script>

<lab-menubar bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { label: prop_label, placement: prop_placement, disabled: prop_disabled, checkedValues: prop_checkedValues, defaultCheckedValues: prop_defaultCheckedValues, menus: prop_menus, value: prop_value, defaultValue: prop_defaultValue } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-menubar>
