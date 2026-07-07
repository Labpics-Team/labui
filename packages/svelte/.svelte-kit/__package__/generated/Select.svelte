<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/select';
  import type { LabSelect } from '@labpics/ui-core/select';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-select> — типы взяты прямо из класса ядра (LabSelect). */
  interface Props {
    size?: LabSelect['size'];
    placement?: LabSelect['placement'];
    multiple?: LabSelect['multiple'];
    disabled?: LabSelect['disabled'];
    name?: LabSelect['name'];
    placeholder?: LabSelect['placeholder'];
    label?: LabSelect['label'];
    value?: LabSelect['value'];
    defaultValue?: LabSelect['defaultValue'];
    items?: LabSelect['items'];
    onOpenChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, placement, multiple, disabled, name, placeholder, label, value, defaultValue, items, onOpenChange, onValueChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, placement, multiple, disabled, name, placeholder, label, value, defaultValue, items });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange, 'value-change': onValueChange }));
</script>

<lab-select bind:this={el} {...rest}>
</lab-select>
