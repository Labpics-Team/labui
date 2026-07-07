<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/number-input';
  import type { LabNumberInput } from '@labpics/ui-core/number-input';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    [key: string]: unknown;
  }

  let { type, size, label, labelHidden, helper, error, value, defaultValue, placeholder, min, max, step, scrubber, allowMouseWheel, readonly, disabled, required, invalid, name, onValueChange, onValueCommit, children, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, label, labelHidden, helper, error, value, defaultValue, placeholder, min, max, step, scrubber, allowMouseWheel, readonly, disabled, required, invalid, name });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-commit': onValueCommit }));
</script>

<lab-number-input bind:this={el} {...rest}>
</lab-number-input>
