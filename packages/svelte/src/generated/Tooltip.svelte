<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/tooltip';
  import type { LabTooltip } from '@labpics/ui-core/tooltip';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-tooltip> — типы взяты прямо из класса ядра (LabTooltip). */
  interface Props {
    placement?: LabTooltip['placement'];
    size?: LabTooltip['size'];
    content?: LabTooltip['content'];
    openDelay?: LabTooltip['openDelay'];
    closeDelay?: LabTooltip['closeDelay'];
    disabled?: LabTooltip['disabled'];
    arrow?: LabTooltip['arrow'];
    onOpenChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { placement: prop_placement, size: prop_size, content: prop_content, openDelay: prop_openDelay, closeDelay: prop_closeDelay, disabled: prop_disabled, arrow: prop_arrow, onOpenChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'content', attr: 'content', kind: 'string' },
    { name: 'openDelay', attr: 'open-delay', kind: 'string' },
    { name: 'closeDelay', attr: 'close-delay', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'arrow', attr: 'arrow', kind: 'boolean' },
  ];

  const server = untrack(() => renderElementParts('lab-tooltip', {
    specs, props: { placement: prop_placement, size: prop_size, content: prop_content, openDelay: prop_openDelay, closeDelay: prop_closeDelay, disabled: prop_disabled, arrow: prop_arrow }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-tooltip bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { placement: prop_placement, size: prop_size, content: prop_content, openDelay: prop_openDelay, closeDelay: prop_closeDelay, disabled: prop_disabled, arrow: prop_arrow } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-tooltip>
