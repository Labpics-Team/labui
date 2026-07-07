<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/textarea';
  import type { LabTextarea } from '@labpics/ui-core/textarea';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-textarea> — типы взяты прямо из класса ядра (LabTextarea). */
  interface Props {
    type?: LabTextarea['type'];
    size?: LabTextarea['size'];
    label?: LabTextarea['label'];
    labelHidden?: LabTextarea['labelHidden'];
    helper?: LabTextarea['helper'];
    error?: LabTextarea['error'];
    value?: LabTextarea['value'];
    placeholder?: LabTextarea['placeholder'];
    rows?: LabTextarea['rows'];
    autoResize?: LabTextarea['autoResize'];
    readonly?: LabTextarea['readonly'];
    disabled?: LabTextarea['disabled'];
    required?: LabTextarea['required'];
    invalid?: LabTextarea['invalid'];
    name?: LabTextarea['name'];
    onLabChange?: (event: CustomEvent) => void;
    onLabInput?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, size, label, labelHidden, helper, error, value, placeholder, rows, autoResize, readonly, disabled, required, invalid, name, onLabChange, onLabInput, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'rows', attr: 'rows', kind: 'string' },
    { name: 'autoResize', attr: 'auto-resize', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, label, labelHidden, helper, error, value, placeholder, rows, autoResize, readonly, disabled, required, invalid, name });
  });
  $effect(() => forwardEvents(el, { 'lab-change': onLabChange, 'lab-input': onLabInput }));
</script>

<lab-textarea bind:this={el} {...rest}>
</lab-textarea>
