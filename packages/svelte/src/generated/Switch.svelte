<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/switch';
  import type { LabSwitch } from '@labpics/ui-core/switch';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-switch> — типы взяты прямо из класса ядра (LabSwitch). */
  interface Props {
    type?: LabSwitch['type'];
    size?: LabSwitch['size'];
    checked?: LabSwitch['checked'];
    defaultChecked?: LabSwitch['defaultChecked'];
    disabled?: LabSwitch['disabled'];
    name?: LabSwitch['name'];
    onCheckedChange?: (event: CustomEvent) => void;
    iconOff?: Snippet;
    iconOn?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, size, checked, defaultChecked, disabled, name, onCheckedChange, children, iconOff, iconOn, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'checked', attr: 'checked', kind: 'boolean' },
    { name: 'defaultChecked', attr: 'default-checked', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { type, size, checked, defaultChecked, disabled, name })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { type, size, checked, defaultChecked, disabled, name });
  });
  $effect(() => forwardEvents(el, { 'checked-change': onCheckedChange }));
</script>

<lab-switch bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
  {#if iconOff}<div slot="icon-off" style="display:contents">{@render iconOff()}</div>{/if}
  {#if iconOn}<div slot="icon-on" style="display:contents">{@render iconOn()}</div>{/if}
</lab-switch>
