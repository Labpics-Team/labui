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
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

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

  let { type, size, label, labelHidden, helper, error, value, placeholder, inputType, autocomplete, readonly, disabled, required, invalid, name, maxLength, minLength, pattern, onLabChange, onLabInput, children, slots, leading, trailing, ...rest }: Props = $props();

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
    specs, props: { type, size, label, labelHidden, helper, error, value, placeholder, inputType, autocomplete, readonly, disabled, required, invalid, name, maxLength, minLength, pattern }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'leading': leading, 'trailing': trailing, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'lab-change': onLabChange, 'lab-input': onLabInput }));
</script>

<lab-input bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type, size, label, labelHidden, helper, error, value, placeholder, inputType, autocomplete, readonly, disabled, required, invalid, name, maxLength, minLength, pattern } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-input>
