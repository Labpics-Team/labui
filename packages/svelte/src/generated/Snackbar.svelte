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
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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

  let { open, message, duration, actionLabel, notificationKey, onLabAction, onLabError, onLabOpenChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'message', attr: 'message', kind: 'string' },
    { name: 'duration', attr: 'duration', kind: 'string' },
    { name: 'actionLabel', attr: 'action-label', kind: 'string' },
    { name: 'notificationKey', attr: 'notification-key', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-snackbar', {
    specs, props: { open, message, duration, actionLabel, notificationKey }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { open, message, duration, actionLabel, notificationKey });
  });
  $effect(() => forwardEvents(el, { 'lab-action': onLabAction, 'lab-error': onLabError, 'lab-open-change': onLabOpenChange }));
</script>

<lab-snackbar bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-snackbar>
