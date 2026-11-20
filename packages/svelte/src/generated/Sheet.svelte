<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/sheet';
  import type { LabSheet } from '@labpics/ui-core/sheet';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

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
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { open, position, modal, closable, heading, description, onMotionError, onOpenChange, onPositionChange, children, slots, content, trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'position', attr: 'position', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-sheet', {
    specs, props: { open, position, modal, closable, heading, description }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'content': content, 'trigger': trigger, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'motion-error': onMotionError, 'open-change': onOpenChange, 'position-change': onPositionChange }));
</script>

<lab-sheet bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open, position, modal, closable, heading, description } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-sheet>
