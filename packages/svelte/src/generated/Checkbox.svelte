<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/checkbox';
  import type { LabCheckbox } from '@labpics/ui-core/checkbox';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-checkbox> — типы взяты прямо из класса ядра (LabCheckbox). */
  interface Props {
    type?: LabCheckbox['type'];
    size?: LabCheckbox['size'];
    variant?: LabCheckbox['variant'];
    checked?: LabCheckbox['checked'];
    indeterminate?: LabCheckbox['indeterminate'];
    defaultChecked?: LabCheckbox['defaultChecked'];
    defaultIndeterminate?: LabCheckbox['defaultIndeterminate'];
    controlled?: LabCheckbox['controlled'];
    disabled?: LabCheckbox['disabled'];
    required?: LabCheckbox['required'];
    name?: LabCheckbox['name'];
    value?: LabCheckbox['value'];
    onCheckedChange?: (event: CustomEvent) => void;
    description?: Snippet;
    icon?: Snippet;
    labelStart?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type, size, variant, checked, indeterminate, defaultChecked, defaultIndeterminate, controlled, disabled, required, name, value, onCheckedChange, children, slots, description, icon, labelStart, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'checked', attr: 'checked', kind: 'boolean' },
    { name: 'indeterminate', attr: 'indeterminate', kind: 'boolean' },
    { name: 'defaultChecked', attr: 'default-checked', kind: 'boolean' },
    { name: 'defaultIndeterminate', attr: 'default-indeterminate', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-checkbox', {
    specs, props: { type, size, variant, checked, indeterminate, defaultChecked, defaultIndeterminate, controlled, disabled, required, name, value }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'description': description, 'icon': icon, 'label-start': labelStart, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'checked-change': onCheckedChange }));
</script>

<lab-checkbox bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type, size, variant, checked, indeterminate, defaultChecked, defaultIndeterminate, controlled, disabled, required, name, value } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-checkbox>
