<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/combobox';
  import type { LabCombobox } from '@labpics/ui-core/combobox';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-combobox> — типы взяты прямо из класса ядра (LabCombobox). */
  interface Props {
    type?: LabCombobox['type'];
    size?: LabCombobox['size'];
    placement?: LabCombobox['placement'];
    multiple?: LabCombobox['multiple'];
    disabled?: LabCombobox['disabled'];
    readonly?: LabCombobox['readonly'];
    required?: LabCombobox['required'];
    invalid?: LabCombobox['invalid'];
    name?: LabCombobox['name'];
    placeholder?: LabCombobox['placeholder'];
    label?: LabCombobox['label'];
    labelHidden?: LabCombobox['labelHidden'];
    helper?: LabCombobox['helper'];
    error?: LabCombobox['error'];
    value?: LabCombobox['value'];
    defaultValue?: LabCombobox['defaultValue'];
    items?: LabCombobox['items'];
    onInputValueChange?: (event: CustomEvent) => void;
    onOpenChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, size, placement, multiple, disabled, readonly, required, invalid, name, placeholder, label, labelHidden, helper, error, value, defaultValue, items, onInputValueChange, onOpenChange, onValueChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, placement, multiple, disabled, readonly, required, invalid, name, placeholder, label, labelHidden, helper, error, value, defaultValue, items });
  });
  $effect(() => forwardEvents(el, { 'input-value-change': onInputValueChange, 'open-change': onOpenChange, 'value-change': onValueChange }));
</script>

<lab-combobox bind:this={el} {...rest}>
</lab-combobox>
