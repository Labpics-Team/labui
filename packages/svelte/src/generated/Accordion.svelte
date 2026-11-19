<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/accordion';
  import type { LabAccordion } from '@labpics/ui-core/accordion';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-accordion> — типы взяты прямо из класса ядра (LabAccordion). */
  interface Props {
    orientation?: LabAccordion['orientation'];
    size?: LabAccordion['size'];
    multiple?: LabAccordion['multiple'];
    collapsible?: LabAccordion['collapsible'];
    disabled?: LabAccordion['disabled'];
    headingLevel?: LabAccordion['headingLevel'];
    value?: LabAccordion['value'];
    defaultValue?: LabAccordion['defaultValue'];
    items?: LabAccordion['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { orientation, size, multiple, collapsible, disabled, headingLevel, value, defaultValue, items, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'collapsible', attr: 'collapsible', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'headingLevel', attr: 'heading-level', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-accordion', {
    specs, props: { orientation, size, multiple, collapsible, disabled, headingLevel, value, defaultValue, items }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { orientation, size, multiple, collapsible, disabled, headingLevel, value, defaultValue, items });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-accordion bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-accordion>
