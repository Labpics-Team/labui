<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/switch';
  import type { LabSwitch } from '@labpics/ui-core/switch';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-switch> — типы взяты прямо из класса ядра (LabSwitch). */
  interface Props {
    type?: LabSwitch['type'];
    size?: LabSwitch['size'];
    checked?: LabSwitch['checked'];
    defaultChecked?: LabSwitch['defaultChecked'];
    controlled?: LabSwitch['controlled'];
    disabled?: LabSwitch['disabled'];
    required?: LabSwitch['required'];
    icon?: LabSwitch['icon'];
    name?: LabSwitch['name'];
    value?: LabSwitch['value'];
    onCheckedChange?: (event: CustomEvent) => void;
    iconOff?: Snippet;
    iconOn?: Snippet;
    labelStart?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, size, checked, defaultChecked, controlled, disabled, required, icon, name, value, onCheckedChange, children, iconOff, iconOn, labelStart, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'checked', attr: 'checked', kind: 'boolean' },
    { name: 'defaultChecked', attr: 'default-checked', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'icon', attr: 'icon', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, checked, defaultChecked, controlled, disabled, required, icon, name, value });
  });
  $effect(() => forwardEvents(el, { 'checked-change': onCheckedChange }));
</script>

<lab-switch bind:this={el} {...rest}>
  {@render children?.()}
  {#if iconOff}<div slot="icon-off" style="display:contents">{@render iconOff()}</div>{/if}
  {#if iconOn}<div slot="icon-on" style="display:contents">{@render iconOn()}</div>{/if}
  {#if labelStart}<div slot="label-start" style="display:contents">{@render labelStart()}</div>{/if}
</lab-switch>
