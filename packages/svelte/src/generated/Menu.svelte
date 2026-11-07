<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/menu';
  import type { LabMenu } from '@labpics/ui-core/menu';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-menu> — типы взяты прямо из класса ядра (LabMenu). */
  interface Props {
    size?: LabMenu['size'];
    placement?: LabMenu['placement'];
    disabled?: LabMenu['disabled'];
    label?: LabMenu['label'];
    items?: LabMenu['items'];
    onOpenChange?: (event: CustomEvent) => void;
    onSelect?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, placement, disabled, label, items, onOpenChange, onSelect, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { size, placement, disabled, label, items })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { size, placement, disabled, label, items });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange, 'select': onSelect }));
</script>

<lab-menu bind:this={el} {...rest} {...initialBooleans}>
</lab-menu>
