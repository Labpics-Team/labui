<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/progress';
  import type { LabProgress } from '@labpics/ui-core/progress';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-progress> — типы взяты прямо из класса ядра (LabProgress). */
  interface Props {
    size?: LabProgress['size'];
    variant?: LabProgress['variant'];
    value?: LabProgress['value'];
    min?: LabProgress['min'];
    max?: LabProgress['max'];
    label?: LabProgress['label'];
    showValueText?: LabProgress['showValueText'];
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size: prop_size, variant: prop_variant, value: prop_value, min: prop_min, max: prop_max, label: prop_label, showValueText: prop_showValueText, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'showValueText', attr: 'show-value-text', kind: 'boolean' },
  ];

  const server = untrack(() => renderElementParts('lab-progress', {
    specs, props: { size: prop_size, variant: prop_variant, value: prop_value, min: prop_min, max: prop_max, label: prop_label, showValueText: prop_showValueText }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-progress bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size: prop_size, variant: prop_variant, value: prop_value, min: prop_min, max: prop_max, label: prop_label, showValueText: prop_showValueText } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-progress>
