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
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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

  let { size, variant, value, min, max, label, showValueText, children, slots, ...rest }: Props = $props();

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
    specs, props: { size, variant, value, min, max, label, showValueText }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, variant, value, min, max, label, showValueText });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-progress bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-progress>
