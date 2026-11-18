<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/chip';
  import type { LabChip } from '@labpics/ui-core/chip';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    [key: string]: unknown;
  }

  let { mode, size, sharp, active, selected, defaultSelected, controlled, disabled, loading, showLeading, name, value, onAction, onRemove, onSelectedChange, children, leading, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { mode, size, sharp, active, selected, defaultSelected, controlled, disabled, loading, showLeading, name, value });
  });
  $effect(() => forwardEvents(el, { 'action': onAction, 'remove': onRemove, 'selected-change': onSelectedChange }));
</script>

<lab-chip bind:this={el} {...rest}>
  {@render children?.()}
  {#if leading}<div slot="leading" style="display:contents">{@render leading()}</div>{/if}
</lab-chip>
