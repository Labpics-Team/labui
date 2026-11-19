<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/switch';
  import type { LabSwitch } from '@labpics/ui-core/switch';
  import { type Snippet, untrack } from 'svelte';
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
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type, size, checked, defaultChecked, controlled, disabled, required, icon, name, value, onCheckedChange, children, slots, iconOff, iconOn, labelStart, ...rest }: Props = $props();

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

  const server = untrack(() => renderElementParts('lab-switch', {
    specs, props: { type, size, checked, defaultChecked, controlled, disabled, required, icon, name, value }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'icon-off': iconOff, 'icon-on': iconOn, 'label-start': labelStart, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, size, checked, defaultChecked, controlled, disabled, required, icon, name, value });
  });
  $effect(() => forwardEvents(el, { 'checked-change': onCheckedChange }));
</script>

<lab-switch bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-switch>
