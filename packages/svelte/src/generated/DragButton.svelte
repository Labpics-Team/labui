<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/drag-button';
  import type { LabDragButton } from '@labpics/ui-core/drag-button';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-drag-button> — типы взяты прямо из класса ядра (LabDragButton). */
  interface Props {
    label?: LabDragButton['label'];
    helperText?: LabDragButton['helperText'];
    showHelper?: LabDragButton['showHelper'];
    pendingText?: LabDragButton['pendingText'];
    successText?: LabDragButton['successText'];
    dangerText?: LabDragButton['dangerText'];
    status?: LabDragButton['status'];
    disabled?: LabDragButton['disabled'];
    resetKey?: LabDragButton['resetKey'];
    onComplete?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { label, helperText, showHelper, pendingText, successText, dangerText, status, disabled, resetKey, onComplete, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'helperText', attr: 'helper-text', kind: 'string' },
    { name: 'showHelper', attr: 'show-helper', kind: 'boolean' },
    { name: 'pendingText', attr: 'pending-text', kind: 'string' },
    { name: 'successText', attr: 'success-text', kind: 'string' },
    { name: 'dangerText', attr: 'danger-text', kind: 'string' },
    { name: 'status', attr: 'status', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'resetKey', attr: 'reset-key', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-drag-button', {
    specs, props: { label, helperText, showHelper, pendingText, successText, dangerText, status, disabled, resetKey }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'complete': onComplete }));
</script>

<lab-drag-button bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { label, helperText, showHelper, pendingText, successText, dangerText, status, disabled, resetKey } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-drag-button>
