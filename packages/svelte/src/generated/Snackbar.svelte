<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/snackbar';
  import type { LabSnackbar } from '@labpics/ui-core/snackbar';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-snackbar> — типы взяты прямо из класса ядра (LabSnackbar). */
  interface Props {
    open?: LabSnackbar['open'];
    message?: LabSnackbar['message'];
    duration?: LabSnackbar['duration'];
    actionLabel?: LabSnackbar['actionLabel'];
    notificationKey?: LabSnackbar['notificationKey'];
    onLabAction?: (event: CustomEvent) => void;
    onLabError?: (event: CustomEvent) => void;
    onLabOpenChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { open: prop_open, message: prop_message, duration: prop_duration, actionLabel: prop_actionLabel, notificationKey: prop_notificationKey, onLabAction, onLabError, onLabOpenChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'message', attr: 'message', kind: 'string' },
    { name: 'duration', attr: 'duration', kind: 'string' },
    { name: 'actionLabel', attr: 'action-label', kind: 'string' },
    { name: 'notificationKey', attr: 'notification-key', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-snackbar', {
    specs, props: { open: prop_open, message: prop_message, duration: prop_duration, actionLabel: prop_actionLabel, notificationKey: prop_notificationKey }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'lab-action': onLabAction, 'lab-error': onLabError, 'lab-open-change': onLabOpenChange }));
</script>

<lab-snackbar bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { open: prop_open, message: prop_message, duration: prop_duration, actionLabel: prop_actionLabel, notificationKey: prop_notificationKey } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-snackbar>
