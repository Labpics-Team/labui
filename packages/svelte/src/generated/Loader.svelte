<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/loader';
  import type { LabLoader } from '@labpics/ui-core/loader';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-loader> — типы взяты прямо из класса ядра (LabLoader). */
  interface Props {
    size?: LabLoader['size'];
    label?: LabLoader['label'];
    value?: LabLoader['value'];
    min?: LabLoader['min'];
    max?: LabLoader['max'];
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size, label, value, min, max, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-loader', {
    specs, props: { size, label, value, min, max }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-loader bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size, label, value, min, max } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-loader>
