<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/alert-dialog';
  import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-alert-dialog> — типы взяты прямо из класса ядра (LabAlertDialog). */
  interface Props {
    open?: LabAlertDialog['open'];
    controlled?: LabAlertDialog['controlled'];
    size?: LabAlertDialog['size'];
    modal?: LabAlertDialog['modal'];
    closable?: LabAlertDialog['closable'];
    heading?: LabAlertDialog['heading'];
    description?: LabAlertDialog['description'];
    closeLabel?: LabAlertDialog['closeLabel'];
    confirmLabel?: LabAlertDialog['confirmLabel'];
    cancelLabel?: LabAlertDialog['cancelLabel'];
    pending?: LabAlertDialog['pending'];
    onCancel?: (event: CustomEvent) => void;
    onConfirm?: (event: CustomEvent) => void;
    onOpenChange?: (event: CustomEvent) => void;
    actions?: Snippet;
    content?: Snippet;
    trigger?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, confirmLabel: prop_confirmLabel, cancelLabel: prop_cancelLabel, pending: prop_pending, onCancel, onConfirm, onOpenChange, children, slots, actions: slot_actions, content: slot_content, trigger: slot_trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'prop' },
    { name: 'closable', attr: 'closable', kind: 'prop' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'closeLabel', attr: 'close-label', kind: 'string' },
    { name: 'confirmLabel', attr: 'confirm-label', kind: 'string' },
    { name: 'cancelLabel', attr: 'cancel-label', kind: 'string' },
    { name: 'pending', attr: 'pending', kind: 'boolean' },
  ];

  const server = untrack(() => renderElementParts('lab-alert-dialog', {
    specs, props: { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, confirmLabel: prop_confirmLabel, cancelLabel: prop_cancelLabel, pending: prop_pending }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'actions': slot_actions, 'content': slot_content, 'trigger': slot_trigger, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'cancel': onCancel, 'confirm': onConfirm, 'open-change': onOpenChange }));
</script>

<lab-alert-dialog bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open: prop_open, controlled: prop_controlled, size: prop_size, modal: prop_modal, closable: prop_closable, heading: prop_heading, description: prop_description, closeLabel: prop_closeLabel, confirmLabel: prop_confirmLabel, cancelLabel: prop_cancelLabel, pending: prop_pending } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-alert-dialog>
