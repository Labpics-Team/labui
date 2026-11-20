<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/popover';
  import type { LabPopover } from '@labpics/ui-core/popover';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-popover> — типы взяты прямо из класса ядра (LabPopover). */
  interface Props {
    open?: LabPopover['open'];
    controlled?: LabPopover['controlled'];
    size?: LabPopover['size'];
    modal?: LabPopover['modal'];
    closable?: LabPopover['closable'];
    heading?: LabPopover['heading'];
    description?: LabPopover['description'];
    closeLabel?: LabPopover['closeLabel'];
    placement?: LabPopover['placement'];
    arrow?: LabPopover['arrow'];
    onOpenChange?: (event: CustomEvent) => void;
    actions?: Snippet;
    content?: Snippet;
    trigger?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, placement: prop_placement, arrow: prop_arrow, onOpenChange, children, slots, actions: slot_actions, content: slot_content, trigger: slot_trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'prop' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'closeLabel', attr: 'close-label', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'arrow', attr: 'arrow', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-popover', {
    specs, props: { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, placement: prop_placement, arrow: prop_arrow }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'actions': slot_actions, 'content': slot_content, 'trigger': slot_trigger, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-popover bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, placement: prop_placement, arrow: prop_arrow } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-popover>
