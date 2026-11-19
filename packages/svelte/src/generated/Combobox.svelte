<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/combobox';
  import type { LabCombobox } from '@labpics/ui-core/combobox';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

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
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type: prop_type, size: prop_size, placement: prop_placement, multiple: prop_multiple, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, invalid: prop_invalid, name: prop_name, placeholder: prop_placeholder, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, items: prop_items, onInputValueChange, onOpenChange, onValueChange, children, slots, ...rest }: Props = $props();

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

  const server = untrack(() => renderElementParts('lab-combobox', {
    specs, props: { type: prop_type, size: prop_size, placement: prop_placement, multiple: prop_multiple, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, invalid: prop_invalid, name: prop_name, placeholder: prop_placeholder, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, items: prop_items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'input-value-change': onInputValueChange, 'open-change': onOpenChange, 'value-change': onValueChange }));
</script>

<lab-combobox bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type: prop_type, size: prop_size, placement: prop_placement, multiple: prop_multiple, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, invalid: prop_invalid, name: prop_name, placeholder: prop_placeholder, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, items: prop_items } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-combobox>
