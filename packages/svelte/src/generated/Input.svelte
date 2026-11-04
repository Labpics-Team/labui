<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/input';
  import type { LabInput } from '@labpics/ui-core/input';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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
    onLabChange?: (event: CustomEvent) => void;
    onLabInput?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, size, label, labelHidden, helper, error, value, placeholder, inputType, autocomplete, readonly, disabled, required, invalid, name, onLabChange, onLabInput, children, ...rest }: Props = $props();

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
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { type, size, label, labelHidden, helper, error, value, placeholder, inputType, autocomplete, readonly, disabled, required, invalid, name })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { type, size, label, labelHidden, helper, error, value, placeholder, inputType, autocomplete, readonly, disabled, required, invalid, name });
  });
  $effect(() => forwardEvents(el, { 'lab-change': onLabChange, 'lab-input': onLabInput }));
</script>

<lab-input bind:this={el} {...rest} {...initialBooleans}>
</lab-input>
