<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/sheet';
  import type { LabSheet } from '@labpics/ui-core/sheet';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-sheet> — типы взяты прямо из класса ядра (LabSheet). */
  interface Props {
    modal?: LabSheet['modal'];
    closable?: LabSheet['closable'];
    heading?: LabSheet['heading'];
    description?: LabSheet['description'];
    open?: LabSheet['open'];
    position?: LabSheet['position'];
    onMotionError?: (event: CustomEvent) => void;
    onOpenChange?: (event: CustomEvent) => void;
    onPositionChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { modal, closable, heading, description, open, position, onMotionError, onOpenChange, onPositionChange, children, content, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'modal', attr: 'modal', kind: 'string' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'position', attr: 'position', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { modal, closable, heading, description, open, position })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { modal, closable, heading, description, open, position });
  });
  $effect(() => forwardEvents(el, { 'motion-error': onMotionError, 'open-change': onOpenChange, 'position-change': onPositionChange }));
</script>

<lab-sheet bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
  {#if content}<div slot="content" style="display:contents">{@render content()}</div>{/if}
</lab-sheet>
