<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/select';
  import type { LabSelect } from '@labpics/ui-core/select';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-select> — типы взяты прямо из класса ядра (LabSelect). */
  interface Props {
    size?: LabSelect['size'];
    placement?: LabSelect['placement'];
    multiple?: LabSelect['multiple'];
    disabled?: LabSelect['disabled'];
    name?: LabSelect['name'];
    required?: LabSelect['required'];
    showLabel?: LabSelect['showLabel'];
    removeLabel?: LabSelect['removeLabel'];
    placeholder?: LabSelect['placeholder'];
    label?: LabSelect['label'];
    value?: LabSelect['value'];
    defaultValue?: LabSelect['defaultValue'];
    items?: LabSelect['items'];
    onOpenChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    leading?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size, placement, multiple, disabled, name, required, showLabel, removeLabel, placeholder, label, value, defaultValue, items, onOpenChange, onValueChange, children, slots, leading, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'showLabel', attr: 'show-label', kind: 'prop' },
    { name: 'removeLabel', attr: 'remove-label', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-select', {
    specs, props: { size, placement, multiple, disabled, name, required, showLabel, removeLabel, placeholder, label, value, defaultValue, items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'leading': leading, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'open-change': onOpenChange, 'value-change': onValueChange }));
</script>

<lab-select bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size, placement, multiple, disabled, name, required, showLabel, removeLabel, placeholder, label, value, defaultValue, items } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-select>
