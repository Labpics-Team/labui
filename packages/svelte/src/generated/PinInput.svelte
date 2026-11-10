<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/pin-input';
  import type { LabPinInput } from '@labpics/ui-core/pin-input';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    [key: string]: unknown;
  }

  let { type, size, label, labelHidden, helper, error, count, valueType, mask, otp, placeholder, value, defaultValue, readonly, disabled, required, invalid, name, onValueChange, onValueComplete, onValueInvalid, children, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { type, size, label, labelHidden, helper, error, count, valueType, mask, otp, placeholder, value, defaultValue, readonly, disabled, required, invalid, name })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { type, size, label, labelHidden, helper, error, count, valueType, mask, otp, placeholder, value, defaultValue, readonly, disabled, required, invalid, name });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange, 'value-complete': onValueComplete, 'value-invalid': onValueInvalid }));
</script>

<lab-pin-input bind:this={el} {...rest} {...initialBooleans}>
</lab-pin-input>
