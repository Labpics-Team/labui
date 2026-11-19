<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/segmented-control';
  import type { LabSegmentedControl } from '@labpics/ui-core/segmented-control';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    [key: string]: unknown;
  }

  let { shape, value, defaultValue, name, label, dir, disabled, required, items, onValueChange, children, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { shape, value, defaultValue, name, label, dir, disabled, required, items });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-segmented-control bind:this={el} {...rest}>
  {@render children?.()}
</lab-segmented-control>
