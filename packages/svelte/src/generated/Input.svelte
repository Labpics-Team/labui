<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/input';
  import type { LabInput } from '@labpics/ui-core/input';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-input> — типы взяты прямо из класса ядра (LabInput). */
  interface Props {
    type?: LabInput['type'];
    size?: LabInput['size'];
    label?: LabInput['label'];
    labelHidden?: LabInput['labelHidden'];
    helper?: LabInput['helper'];
    error?: LabInput['error'];
    value?: LabInput['value'];
    placeholder?: LabInput['placeholder'];
    inputType?: LabInput['inputType'];
    autocomplete?: LabInput['autocomplete'];
    readonly?: LabInput['readonly'];
    disabled?: LabInput['disabled'];
    required?: LabInput['required'];
    invalid?: LabInput['invalid'];
    name?: LabInput['name'];
    maxLength?: LabInput['maxLength'];
    minLength?: LabInput['minLength'];
    pattern?: LabInput['pattern'];
    onLabChange?: (event: CustomEvent) => void;
    onLabInput?: (event: CustomEvent) => void;
    leading?: Snippet;
    trailing?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, placeholder: prop_placeholder, inputType: prop_inputType, autocomplete: prop_autocomplete, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name, maxLength: prop_maxLength, minLength: prop_minLength, pattern: prop_pattern, onLabChange, onLabInput, children, slots, leading: slot_leading, trailing: slot_trailing, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'inputType', attr: 'input-type', kind: 'string' },
    { name: 'autocomplete', attr: 'autocomplete', kind: 'string' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'maxLength', attr: 'maxlength', kind: 'string' },
    { name: 'minLength', attr: 'minlength', kind: 'string' },
    { name: 'pattern', attr: 'pattern', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-input', {
    specs, props: { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, placeholder: prop_placeholder, inputType: prop_inputType, autocomplete: prop_autocomplete, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name, maxLength: prop_maxLength, minLength: prop_minLength, pattern: prop_pattern }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'leading': slot_leading, 'trailing': slot_trailing, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'lab-change': onLabChange, 'lab-input': onLabInput }));
</script>

<lab-input bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, placeholder: prop_placeholder, inputType: prop_inputType, autocomplete: prop_autocomplete, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name, maxLength: prop_maxLength, minLength: prop_minLength, pattern: prop_pattern } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-input>
