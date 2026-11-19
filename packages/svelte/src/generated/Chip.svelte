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

  let { mode: prop_mode, size: prop_size, sharp: prop_sharp, active: prop_active, selected: prop_selected, defaultSelected: prop_defaultSelected, controlled: prop_controlled, disabled: prop_disabled, loading: prop_loading, showLeading: prop_showLeading, name: prop_name, value: prop_value, onAction, onRemove, onSelectedChange, children, slots, leading: slot_leading, ...rest }: Props = $props();

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
    specs, props: { mode: prop_mode, size: prop_size, sharp: prop_sharp, active: prop_active, selected: prop_selected, defaultSelected: prop_defaultSelected, controlled: prop_controlled, disabled: prop_disabled, loading: prop_loading, showLeading: prop_showLeading, name: prop_name, value: prop_value }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'leading': slot_leading, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'action': onAction, 'remove': onRemove, 'selected-change': onSelectedChange }));
</script>

<lab-chip bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { mode: prop_mode, size: prop_size, sharp: prop_sharp, active: prop_active, selected: prop_selected, defaultSelected: prop_defaultSelected, controlled: prop_controlled, disabled: prop_disabled, loading: prop_loading, showLeading: prop_showLeading, name: prop_name, value: prop_value } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-chip>
