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
    imageSrc?: LabCard['imageSrc'];
    imageAlt?: LabCard['imageAlt'];
    heading?: LabCard['heading'];
    headingLevel?: LabCard['headingLevel'];
    caption?: LabCard['caption'];
    description?: LabCard['description'];
    lowerCaption?: LabCard['lowerCaption'];
    titleHint?: LabCard['titleHint'];
    badge?: LabCard['badge'];
    footer?: Snippet;
    header?: Snippet;
    media?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { variant, padding, interactive, imageSrc, imageAlt, heading, headingLevel, caption, description, lowerCaption, titleHint, badge, children, footer, header, media, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'padding', attr: 'padding', kind: 'string' },
    { name: 'interactive', attr: 'interactive', kind: 'boolean' },
    { name: 'imageSrc', attr: 'image-src', kind: 'string' },
    { name: 'imageAlt', attr: 'image-alt', kind: 'string' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'headingLevel', attr: 'heading-level', kind: 'string' },
    { name: 'caption', attr: 'caption', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'lowerCaption', attr: 'lower-caption', kind: 'string' },
    { name: 'titleHint', attr: 'title-hint', kind: 'string' },
    { name: 'badge', attr: 'badge', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { variant, padding, interactive, imageSrc, imageAlt, heading, headingLevel, caption, description, lowerCaption, titleHint, badge });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-card bind:this={el} {...rest}>
  {@render children?.()}
  {#if footer}<div slot="footer" style="display:contents">{@render footer()}</div>{/if}
  {#if header}<div slot="header" style="display:contents">{@render header()}</div>{/if}
  {#if media}<div slot="media" style="display:contents">{@render media()}</div>{/if}
</lab-card>
