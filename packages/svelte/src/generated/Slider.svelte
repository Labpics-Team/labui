<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/slider';
  import type { LabSlider } from '@labpics/ui-core/slider';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-slider> — типы взяты прямо из класса ядра (LabSlider). */
  interface Props {
    size?: LabSlider['size'];
    orientation?: LabSlider['orientation'];
    label?: LabSlider['label'];
    labelHidden?: LabSlider['labelHidden'];
    helper?: LabSlider['helper'];
    error?: LabSlider['error'];
    value?: LabSlider['value'];
    defaultValue?: LabSlider['defaultValue'];
    min?: LabSlider['min'];
    max?: LabSlider['max'];
    step?: LabSlider['step'];
    marks?: LabSlider['marks'];
    showValue?: LabSlider['showValue'];
    readonly?: LabSlider['readonly'];
    disabled?: LabSlider['disabled'];
    invalid?: LabSlider['invalid'];
    name?: LabSlider['name'];
    onValueChange?: (event: CustomEvent) => void;
    onValueChangeEnd?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size: prop_size, orientation: prop_orientation, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, min: prop_min, max: prop_max, step: prop_step, marks: prop_marks, showValue: prop_showValue, readonly: prop_readonly, disabled: prop_disabled, invalid: prop_invalid, name: prop_name, onValueChange, onValueChangeEnd, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'step', attr: 'step', kind: 'string' },
    { name: 'marks', attr: 'marks', kind: 'prop' },
    { name: 'showValue', attr: 'show-value', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-slider', {
    specs, props: { size: prop_size, orientation: prop_orientation, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, min: prop_min, max: prop_max, step: prop_step, marks: prop_marks, showValue: prop_showValue, readonly: prop_readonly, disabled: prop_disabled, invalid: prop_invalid, name: prop_name }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-change-end': onValueChangeEnd }));
</script>

<lab-slider bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size: prop_size, orientation: prop_orientation, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, value: prop_value, defaultValue: prop_defaultValue, min: prop_min, max: prop_max, step: prop_step, marks: prop_marks, showValue: prop_showValue, readonly: prop_readonly, disabled: prop_disabled, invalid: prop_invalid, name: prop_name } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-slider>
