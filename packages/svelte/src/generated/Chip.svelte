<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/chip';
  import type { LabChip } from '@labpics/ui-core/chip';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-chip> — типы взяты прямо из класса ядра (LabChip). */
  interface Props {
    mode?: LabChip['mode'];
    size?: LabChip['size'];
    sharp?: LabChip['sharp'];
    active?: LabChip['active'];
    selected?: LabChip['selected'];
    defaultSelected?: LabChip['defaultSelected'];
    controlled?: LabChip['controlled'];
    disabled?: LabChip['disabled'];
    loading?: LabChip['loading'];
    showLeading?: LabChip['showLeading'];
    name?: LabChip['name'];
    value?: LabChip['value'];
    onAction?: (event: CustomEvent) => void;
    onRemove?: (event: CustomEvent) => void;
    onSelectedChange?: (event: CustomEvent) => void;
    leading?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { mode, size, sharp, active, selected, defaultSelected, controlled, disabled, loading, showLeading, name, value, onAction, onRemove, onSelectedChange, children, slots, leading, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'mode', attr: 'mode', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'sharp', attr: 'sharp', kind: 'boolean' },
    { name: 'active', attr: 'active', kind: 'boolean' },
    { name: 'selected', attr: 'selected', kind: 'boolean' },
    { name: 'defaultSelected', attr: 'default-selected', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'loading', attr: 'loading', kind: 'boolean' },
    { name: 'showLeading', attr: 'show-leading', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-chip', {
    specs, props: { mode, size, sharp, active, selected, defaultSelected, controlled, disabled, loading, showLeading, name, value }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'leading': leading, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'action': onAction, 'remove': onRemove, 'selected-change': onSelectedChange }));
</script>

<lab-chip bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { mode, size, sharp, active, selected, defaultSelected, controlled, disabled, loading, showLeading, name, value } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-chip>
