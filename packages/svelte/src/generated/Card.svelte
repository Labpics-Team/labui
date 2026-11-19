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
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

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

  $effect(() => {
    forwardDeclared(el, specs, { variant, padding, interactive, image, imageAlt, heading, headingHint, description, caption, lowerCaption });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-card bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-card>
