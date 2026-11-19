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

  let { open: prop_open, position: prop_position, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, onMotionError, onOpenChange, onPositionChange, children, slots, content: slot_content, trigger: slot_trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'position', attr: 'position', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-sheet', {
    specs, props: { open: prop_open, position: prop_position, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'content': slot_content, 'trigger': slot_trigger, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'motion-error': onMotionError, 'open-change': onOpenChange, 'position-change': onPositionChange }));
</script>

<lab-sheet bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open: prop_open, position: prop_position, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-sheet>
