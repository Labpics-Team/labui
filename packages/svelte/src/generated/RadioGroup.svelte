<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/radio-group';
  import type { LabRadioGroup } from '@labpics/ui-core/radio-group';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-radio-group> — типы взяты прямо из класса ядра (LabRadioGroup). */
  interface Props {
    type?: LabRadioGroup['type'];
    size?: LabRadioGroup['size'];
    variant?: LabRadioGroup['variant'];
    orientation?: LabRadioGroup['orientation'];
    value?: LabRadioGroup['value'];
    defaultValue?: LabRadioGroup['defaultValue'];
    controlled?: LabRadioGroup['controlled'];
    disabled?: LabRadioGroup['disabled'];
    required?: LabRadioGroup['required'];
    name?: LabRadioGroup['name'];
    label?: LabRadioGroup['label'];
    items?: LabRadioGroup['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type, size, variant, orientation, value, defaultValue, controlled, disabled, required, name, label, items, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-radio-group', {
    specs, props: { type, size, variant, orientation, value, defaultValue, controlled, disabled, required, name, label, items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, variant, orientation, value, defaultValue, controlled, disabled, required, name, label, items });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-radio-group bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-radio-group>
