<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/dialog';
  import type { LabDialog } from '@labpics/ui-core/dialog';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-dialog> — типы взяты прямо из класса ядра (LabDialog). */
  interface Props {
    size?: LabDialog['size'];
    modal?: LabDialog['modal'];
    closable?: LabDialog['closable'];
    heading?: LabDialog['heading'];
    description?: LabDialog['description'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, modal, closable, heading, description, onOpenChange, children, content, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'string' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, modal, closable, heading, description });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-dialog bind:this={el} {...rest}>
  {@render children?.()}
  {#if content}<div slot="content" style="display:contents">{@render content()}</div>{/if}
</lab-dialog>
