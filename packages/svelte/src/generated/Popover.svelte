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
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-popover> — типы взяты прямо из класса ядра (LabPopover). */
  interface Props {
    placement?: LabPopover['placement'];
    size?: LabPopover['size'];
    modal?: LabPopover['modal'];
    closable?: LabPopover['closable'];
    arrow?: LabPopover['arrow'];
    heading?: LabPopover['heading'];
    description?: LabPopover['description'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { placement, size, modal, closable, arrow, heading, description, onOpenChange, children, slots, content, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'boolean' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'arrow', attr: 'arrow', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-popover', {
    specs, props: { placement, size, modal, closable, arrow, heading, description }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'content': content, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { placement, size, modal, closable, arrow, heading, description });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-popover bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-popover>
