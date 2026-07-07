<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/checkbox';
  import type { LabCheckbox } from '@labpics/ui-core/checkbox';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-checkbox> — типы взяты прямо из класса ядра (LabCheckbox). */
  interface Props {
    type?: LabCheckbox['type'];
    size?: LabCheckbox['size'];
    checked?: LabCheckbox['checked'];
    indeterminate?: LabCheckbox['indeterminate'];
    defaultChecked?: LabCheckbox['defaultChecked'];
    defaultIndeterminate?: LabCheckbox['defaultIndeterminate'];
    disabled?: LabCheckbox['disabled'];
    name?: LabCheckbox['name'];
    onCheckedChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, size, checked, indeterminate, defaultChecked, defaultIndeterminate, disabled, name, onCheckedChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'checked', attr: 'checked', kind: 'boolean' },
    { name: 'indeterminate', attr: 'indeterminate', kind: 'boolean' },
    { name: 'defaultChecked', attr: 'default-checked', kind: 'boolean' },
    { name: 'defaultIndeterminate', attr: 'default-indeterminate', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, checked, indeterminate, defaultChecked, defaultIndeterminate, disabled, name });
  });
  $effect(() => forwardEvents(el, { 'checked-change': onCheckedChange }));
</script>

<lab-checkbox bind:this={el} {...rest}>
  {@render children?.()}
</lab-checkbox>
