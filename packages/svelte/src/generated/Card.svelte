<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/card';
  import type { LabCard } from '@labpics/ui-core/card';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-card> — типы взяты прямо из класса ядра (LabCard). */
  interface Props {
    variant?: LabCard['variant'];
    padding?: LabCard['padding'];
    interactive?: LabCard['interactive'];
    image?: LabCard['image'];
    imageAlt?: LabCard['imageAlt'];
    heading?: LabCard['heading'];
    headingHint?: LabCard['headingHint'];
    description?: LabCard['description'];
    caption?: LabCard['caption'];
    lowerCaption?: LabCard['lowerCaption'];
    badge?: Snippet;
    footer?: Snippet;
    header?: Snippet;
    media?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { variant, padding, interactive, image, imageAlt, heading, headingHint, description, caption, lowerCaption, children, slots, badge, footer, header, media, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'padding', attr: 'padding', kind: 'string' },
    { name: 'interactive', attr: 'interactive', kind: 'boolean' },
    { name: 'image', attr: 'image', kind: 'string' },
    { name: 'imageAlt', attr: 'image-alt', kind: 'string' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'headingHint', attr: 'heading-hint', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'caption', attr: 'caption', kind: 'string' },
    { name: 'lowerCaption', attr: 'lower-caption', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-card', {
    specs, props: { variant, padding, interactive, image, imageAlt, heading, headingHint, description, caption, lowerCaption }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'badge': badge, 'footer': footer, 'header': header, 'media': media, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-card bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { variant, padding, interactive, image, imageAlt, heading, headingHint, description, caption, lowerCaption } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-card>
