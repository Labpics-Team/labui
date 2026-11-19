<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/tags-input';
  import type { LabTagsInput } from '@labpics/ui-core/tags-input';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-tags-input> — типы взяты прямо из класса ядра (LabTagsInput). */
  interface Props {
    type?: LabTagsInput['type'];
    size?: LabTagsInput['size'];
    label?: LabTagsInput['label'];
    labelHidden?: LabTagsInput['labelHidden'];
    helper?: LabTagsInput['helper'];
    error?: LabTagsInput['error'];
    placeholder?: LabTagsInput['placeholder'];
    max?: LabTagsInput['max'];
    delimiter?: LabTagsInput['delimiter'];
    editable?: LabTagsInput['editable'];
    addOnPaste?: LabTagsInput['addOnPaste'];
    allowDuplicates?: LabTagsInput['allowDuplicates'];
    value?: LabTagsInput['value'];
    defaultValue?: LabTagsInput['defaultValue'];
    readonly?: LabTagsInput['readonly'];
    disabled?: LabTagsInput['disabled'];
    required?: LabTagsInput['required'];
    invalid?: LabTagsInput['invalid'];
    name?: LabTagsInput['name'];
    onInputValueChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    onValueInvalid?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, placeholder: prop_placeholder, max: prop_max, delimiter: prop_delimiter, editable: prop_editable, addOnPaste: prop_addOnPaste, allowDuplicates: prop_allowDuplicates, value: prop_value, defaultValue: prop_defaultValue, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name, onInputValueChange, onValueChange, onValueInvalid, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'delimiter', attr: 'delimiter', kind: 'string' },
    { name: 'editable', attr: 'editable', kind: 'boolean' },
    { name: 'addOnPaste', attr: 'add-on-paste', kind: 'boolean' },
    { name: 'allowDuplicates', attr: 'allow-duplicates', kind: 'boolean' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-tags-input', {
    specs, props: { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, placeholder: prop_placeholder, max: prop_max, delimiter: prop_delimiter, editable: prop_editable, addOnPaste: prop_addOnPaste, allowDuplicates: prop_allowDuplicates, value: prop_value, defaultValue: prop_defaultValue, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'input-value-change': onInputValueChange, 'value-change': onValueChange, 'value-invalid': onValueInvalid }));
</script>

<lab-tags-input bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, placeholder: prop_placeholder, max: prop_max, delimiter: prop_delimiter, editable: prop_editable, addOnPaste: prop_addOnPaste, allowDuplicates: prop_allowDuplicates, value: prop_value, defaultValue: prop_defaultValue, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-tags-input>
