<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/slider';
  import type { LabSlider } from '@labpics/ui-core/slider';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    [key: string]: unknown;
  }

  let { size, orientation, label, labelHidden, helper, error, value, defaultValue, min, max, step, marks, showValue, readonly, disabled, invalid, name, onValueChange, onValueChangeEnd, children, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, orientation, label, labelHidden, helper, error, value, defaultValue, min, max, step, marks, showValue, readonly, disabled, invalid, name });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-change-end': onValueChangeEnd }));
</script>

<lab-slider bind:this={el} {...rest}>
</lab-slider>
