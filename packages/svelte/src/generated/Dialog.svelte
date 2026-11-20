<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/dialog';
  import type { LabDialog } from '@labpics/ui-core/dialog';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-dialog> — типы взяты прямо из класса ядра (LabDialog). */
  interface Props {
    open?: LabDialog['open'];
    controlled?: LabDialog['controlled'];
    size?: LabDialog['size'];
    modal?: LabDialog['modal'];
    closable?: LabDialog['closable'];
    heading?: LabDialog['heading'];
    description?: LabDialog['description'];
    closeLabel?: LabDialog['closeLabel'];
    onOpenChange?: (event: CustomEvent) => void;
    actions?: Snippet;
    content?: Snippet;
    trigger?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, onOpenChange, children, slots, actions: slot_actions, content: slot_content, trigger: slot_trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'prop' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'closeLabel', attr: 'close-label', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-dialog', {
    specs, props: { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'actions': slot_actions, 'content': slot_content, 'trigger': slot_trigger, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-dialog bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-dialog>
