<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/accordion';
  import type { LabAccordion } from '@labpics/ui-core/accordion';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-accordion> — типы взяты прямо из класса ядра (LabAccordion). */
  interface Props {
    orientation?: LabAccordion['orientation'];
    size?: LabAccordion['size'];
    multiple?: LabAccordion['multiple'];
    collapsible?: LabAccordion['collapsible'];
    disabled?: LabAccordion['disabled'];
    value?: LabAccordion['value'];
    defaultValue?: LabAccordion['defaultValue'];
    items?: LabAccordion['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { orientation, size, multiple, collapsible, disabled, value, defaultValue, items, onValueChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'collapsible', attr: 'collapsible', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { orientation, size, multiple, collapsible, disabled, value, defaultValue, items })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { orientation, size, multiple, collapsible, disabled, value, defaultValue, items });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-accordion bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
</lab-accordion>
