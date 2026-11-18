<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/choicebox';
  import type { LabChoicebox } from '@labpics/ui-core/choicebox';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    [key: string]: unknown;
  }

  let { layout, multiple, value, defaultValue, controlled, disabled, required, name, label, items, onValueChange, children, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { layout, multiple, value, defaultValue, controlled, disabled, required, name, label, items });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-choicebox bind:this={el} {...rest}>
  {@render children?.()}
</lab-choicebox>
