<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/pin-input';
  import type { LabPinInput } from '@labpics/ui-core/pin-input';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-pin-input> — типы взяты прямо из класса ядра (LabPinInput). */
  interface Props {
    type?: LabPinInput['type'];
    size?: LabPinInput['size'];
    label?: LabPinInput['label'];
    labelHidden?: LabPinInput['labelHidden'];
    helper?: LabPinInput['helper'];
    error?: LabPinInput['error'];
    count?: LabPinInput['count'];
    valueType?: LabPinInput['valueType'];
    mask?: LabPinInput['mask'];
    otp?: LabPinInput['otp'];
    placeholder?: LabPinInput['placeholder'];
    value?: LabPinInput['value'];
    defaultValue?: LabPinInput['defaultValue'];
    readonly?: LabPinInput['readonly'];
    disabled?: LabPinInput['disabled'];
    required?: LabPinInput['required'];
    invalid?: LabPinInput['invalid'];
    name?: LabPinInput['name'];
    onValueChange?: (event: CustomEvent) => void;
    onValueComplete?: (event: CustomEvent) => void;
    onValueInvalid?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type, size, label, labelHidden, helper, error, count, valueType, mask, otp, placeholder, value, defaultValue, readonly, disabled, required, invalid, name, onValueChange, onValueComplete, onValueInvalid, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'count', attr: 'count', kind: 'string' },
    { name: 'valueType', attr: 'value-type', kind: 'string' },
    { name: 'mask', attr: 'mask', kind: 'boolean' },
    { name: 'otp', attr: 'otp', kind: 'boolean' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-pin-input', {
    specs, props: { type, size, label, labelHidden, helper, error, count, valueType, mask, otp, placeholder, value, defaultValue, readonly, disabled, required, invalid, name }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-complete': onValueComplete, 'value-invalid': onValueInvalid }));
</script>

<lab-pin-input bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type, size, label, labelHidden, helper, error, count, valueType, mask, otp, placeholder, value, defaultValue, readonly, disabled, required, invalid, name } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-pin-input>
