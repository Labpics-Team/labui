<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/card';
  import type { LabCard } from '@labpics/ui-core/card';
  import type { Snippet } from 'svelte';
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
    [key: string]: unknown;
  }

  let { variant, padding, interactive, image, imageAlt, heading, headingHint, description, caption, lowerCaption, children, badge, footer, header, media, ...rest }: Props = $props();

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

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { variant, padding, interactive, image, imageAlt, heading, headingHint, description, caption, lowerCaption });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-card bind:this={el} {...rest}>
  {@render children?.()}
  {#if badge}<div slot="badge" style="display:contents">{@render badge()}</div>{/if}
  {#if footer}<div slot="footer" style="display:contents">{@render footer()}</div>{/if}
  {#if header}<div slot="header" style="display:contents">{@render header()}</div>{/if}
  {#if media}<div slot="media" style="display:contents">{@render media()}</div>{/if}
</lab-card>
