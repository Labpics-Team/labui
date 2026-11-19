<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/number-input';
  import type { LabNumberInput } from '@labpics/ui-core/number-input';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-number-input> — типы взяты прямо из класса ядра (LabNumberInput). */
  interface Props {
    type?: LabNumberInput['type'];
    size?: LabNumberInput['size'];
    label?: LabNumberInput['label'];
    labelHidden?: LabNumberInput['labelHidden'];
    helper?: LabNumberInput['helper'];
    error?: LabNumberInput['error'];
    value?: LabNumberInput['value'];
    defaultValue?: LabNumberInput['defaultValue'];
    placeholder?: LabNumberInput['placeholder'];
    min?: LabNumberInput['min'];
    max?: LabNumberInput['max'];
    step?: LabNumberInput['step'];
    scrubber?: LabNumberInput['scrubber'];
    allowMouseWheel?: LabNumberInput['allowMouseWheel'];
    readonly?: LabNumberInput['readonly'];
    disabled?: LabNumberInput['disabled'];
    required?: LabNumberInput['required'];
    invalid?: LabNumberInput['invalid'];
    name?: LabNumberInput['name'];
    onValueChange?: (event: CustomEvent) => void;
    onValueCommit?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, placeholder: prop_placeholder, min: prop_min, max: prop_max, step: prop_step, scrubber: prop_scrubber, allowMouseWheel: prop_allowMouseWheel, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name, onValueChange, onValueCommit, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'step', attr: 'step', kind: 'string' },
    { name: 'scrubber', attr: 'scrubber', kind: 'boolean' },
    { name: 'allowMouseWheel', attr: 'allow-mouse-wheel', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-number-input', {
    specs, props: { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, placeholder: prop_placeholder, min: prop_min, max: prop_max, step: prop_step, scrubber: prop_scrubber, allowMouseWheel: prop_allowMouseWheel, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-commit': onValueCommit }));
</script>

<lab-number-input bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type: prop_type, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, placeholder: prop_placeholder, min: prop_min, max: prop_max, step: prop_step, scrubber: prop_scrubber, allowMouseWheel: prop_allowMouseWheel, readonly: prop_readonly, disabled: prop_disabled, required: prop_required, invalid: prop_invalid, name: prop_name } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-number-input>
