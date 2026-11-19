<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/alert';
  import type { LabAlert } from '@labpics/ui-core/alert';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-alert> — типы взяты прямо из класса ядра (LabAlert). */
  interface Props {
    open?: LabAlert['open'];
    controlled?: LabAlert['controlled'];
    type?: LabAlert['type'];
    quantity?: LabAlert['quantity'];
    heading?: LabAlert['heading'];
    description?: LabAlert['description'];
    showIcon?: LabAlert['showIcon'];
    closeLabel?: LabAlert['closeLabel'];
    announcement?: LabAlert['announcement'];
    notificationKey?: LabAlert['notificationKey'];
    onDismiss?: (event: CustomEvent) => void;
    icon?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { open: prop_open, controlled: prop_controlled, type: prop_type, quantity: prop_quantity, heading: prop_heading, description: prop_description, showIcon: prop_showIcon, closeLabel: prop_closeLabel, announcement: prop_announcement, notificationKey: prop_notificationKey, onDismiss, children, slots, icon: slot_icon, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'prop' },
    { name: 'controlled', attr: 'controlled', kind: 'boolean' },
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'quantity', attr: 'quantity', kind: 'string' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'showIcon', attr: 'show-icon', kind: 'prop' },
    { name: 'closeLabel', attr: 'close-label', kind: 'string' },
    { name: 'announcement', attr: 'announcement', kind: 'string' },
    { name: 'notificationKey', attr: 'notification-key', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-alert', {
    specs, props: { open: prop_open, controlled: prop_controlled, type: prop_type, quantity: prop_quantity, heading: prop_heading, description: prop_description, showIcon: prop_showIcon, closeLabel: prop_closeLabel, announcement: prop_announcement, notificationKey: prop_notificationKey }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'icon': slot_icon, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'dismiss': onDismiss }));
</script>

<lab-alert bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open: prop_open, controlled: prop_controlled, type: prop_type, quantity: prop_quantity, heading: prop_heading, description: prop_description, showIcon: prop_showIcon, closeLabel: prop_closeLabel, announcement: prop_announcement, notificationKey: prop_notificationKey } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-alert>
