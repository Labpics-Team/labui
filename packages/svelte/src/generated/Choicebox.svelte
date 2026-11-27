<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/choicebox';
  import type { LabChoicebox } from '@labpics/ui-core/choicebox';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-choicebox> — типы взяты прямо из класса ядра (LabChoicebox). */
  interface Props {
    layout?: LabChoicebox['layout'];
    multiple?: LabChoicebox['multiple'];
    value?: LabChoicebox['value'];
    defaultValue?: LabChoicebox['defaultValue'];
    controlled?: LabChoicebox['controlled'];
    disabled?: LabChoicebox['disabled'];
    required?: LabChoicebox['required'];
    name?: LabChoicebox['name'];
    label?: LabChoicebox['label'];
    items?: LabChoicebox['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { layout, multiple, value, defaultValue, controlled, disabled, required, name, label, items, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'layout', attr: 'layout', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-choicebox', {
    specs, props: { layout, multiple, value, defaultValue, controlled, disabled, required, name, label, items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-choicebox bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { layout, multiple, value, defaultValue, controlled, disabled, required, name, label, items } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-choicebox>
