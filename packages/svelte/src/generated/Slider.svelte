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
    variant?: LabSlider['variant'];
    orientation?: LabSlider['orientation'];
    size?: LabSlider['size'];
    label?: LabSlider['label'];
    labelHidden?: LabSlider['labelHidden'];
    helper?: LabSlider['helper'];
    error?: LabSlider['error'];
    name?: LabSlider['name'];
    form?: LabSlider['form'];
    value?: LabSlider['value'];
    defaultValue?: LabSlider['defaultValue'];
    min?: LabSlider['min'];
    max?: LabSlider['max'];
    step?: LabSlider['step'];
    showValue?: LabSlider['showValue'];
    readonly?: LabSlider['readonly'];
    disabled?: LabSlider['disabled'];
    invalid?: LabSlider['invalid'];
    thumbLabels?: LabSlider['thumbLabels'];
    onValueChange?: (event: CustomEvent) => void;
    onValueChangeEnd?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { variant: prop_variant, orientation: prop_orientation, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, name: prop_name, form: prop_form, value: prop_value, defaultValue: prop_defaultValue, min: prop_min, max: prop_max, step: prop_step, showValue: prop_showValue, readonly: prop_readonly, disabled: prop_disabled, invalid: prop_invalid, thumbLabels: prop_thumbLabels, onValueChange, onValueChangeEnd, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'form', attr: 'form', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'step', attr: 'step', kind: 'string' },
    { name: 'showValue', attr: 'show-value', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'thumbLabels', attr: 'thumb-labels', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-slider', {
    specs, props: { variant: prop_variant, orientation: prop_orientation, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, name: prop_name, form: prop_form, value: prop_value, defaultValue: prop_defaultValue, min: prop_min, max: prop_max, step: prop_step, showValue: prop_showValue, readonly: prop_readonly, disabled: prop_disabled, invalid: prop_invalid, thumbLabels: prop_thumbLabels }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-change-end': onValueChangeEnd }));
</script>

<lab-slider bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { variant: prop_variant, orientation: prop_orientation, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, name: prop_name, form: prop_form, value: prop_value, defaultValue: prop_defaultValue, min: prop_min, max: prop_max, step: prop_step, showValue: prop_showValue, readonly: prop_readonly, disabled: prop_disabled, invalid: prop_invalid, thumbLabels: prop_thumbLabels } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-slider>
