<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/snackbar';
  import type { LabSnackbar } from '@labpics/ui-core/snackbar';
  import type { Snippet } from 'svelte';
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
    [key: string]: unknown;
  }

  let { open, message, duration, actionLabel, notificationKey, onLabAction, onLabError, onLabOpenChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'open', attr: 'open', kind: 'boolean' },
    { name: 'message', attr: 'message', kind: 'string' },
    { name: 'duration', attr: 'duration', kind: 'string' },
    { name: 'actionLabel', attr: 'action-label', kind: 'string' },
    { name: 'notificationKey', attr: 'notification-key', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { open, message, duration, actionLabel, notificationKey });
  });
  $effect(() => forwardEvents(el, { 'lab-action': onLabAction, 'lab-error': onLabError, 'lab-open-change': onLabOpenChange }));
</script>

<lab-snackbar bind:this={el} {...rest}>
</lab-snackbar>
