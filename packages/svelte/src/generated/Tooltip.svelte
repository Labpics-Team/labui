<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/tooltip';
  import type { LabTooltip } from '@labpics/ui-core/tooltip';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-tooltip> — типы взяты прямо из класса ядра (LabTooltip). */
  interface Props {
    placement?: LabTooltip['placement'];
    size?: LabTooltip['size'];
    content?: LabTooltip['content'];
    openDelay?: LabTooltip['openDelay'];
    closeDelay?: LabTooltip['closeDelay'];
    disabled?: LabTooltip['disabled'];
    arrow?: LabTooltip['arrow'];
    onOpenChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { placement, size, content, openDelay, closeDelay, disabled, arrow, onOpenChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'content', attr: 'content', kind: 'string' },
    { name: 'openDelay', attr: 'open-delay', kind: 'string' },
    { name: 'closeDelay', attr: 'close-delay', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'arrow', attr: 'arrow', kind: 'boolean' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { placement, size, content, openDelay, closeDelay, disabled, arrow })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { placement, size, content, openDelay, closeDelay, disabled, arrow });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-tooltip bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
</lab-tooltip>
