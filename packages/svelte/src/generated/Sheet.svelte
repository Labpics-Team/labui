<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/sheet';
  import type { LabSheet } from '@labpics/ui-core/sheet';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-sheet> — типы взяты прямо из класса ядра (LabSheet). */
  interface Props {
    open?: LabSheet['open'];
    position?: LabSheet['position'];
    modal?: LabSheet['modal'];
    closable?: LabSheet['closable'];
    heading?: LabSheet['heading'];
    description?: LabSheet['description'];
    onMotionError?: (event: CustomEvent) => void;
    onOpenChange?: (event: CustomEvent) => void;
    onPositionChange?: (event: CustomEvent) => void;
    content?: Snippet;
    trigger?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { open, position, modal, closable, heading, description, onMotionError, onOpenChange, onPositionChange, children, content, trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'position', attr: 'position', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { open, position, modal, closable, heading, description });
  });
  $effect(() => forwardEvents(el, { 'motion-error': onMotionError, 'open-change': onOpenChange, 'position-change': onPositionChange }));
</script>

<lab-sheet bind:this={el} {...rest}>
  {@render children?.()}
  {#if content}<div slot="content" style="display:contents">{@render content()}</div>{/if}
  {#if trigger}<div slot="trigger" style="display:contents">{@render trigger()}</div>{/if}
</lab-sheet>
