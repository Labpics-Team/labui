<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/card';
  import type { LabCard } from '@labpics/ui-core/card';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-card> — типы взяты прямо из класса ядра (LabCard). */
  interface Props {
    variant?: LabCard['variant'];
    padding?: LabCard['padding'];
    interactive?: LabCard['interactive'];
    footer?: Snippet;
    header?: Snippet;
    media?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { variant, padding, interactive, children, footer, header, media, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'padding', attr: 'padding', kind: 'string' },
    { name: 'interactive', attr: 'interactive', kind: 'boolean' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { variant, padding, interactive })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { variant, padding, interactive });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-card bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
  {#if footer}<div slot="footer" style="display:contents">{@render footer()}</div>{/if}
  {#if header}<div slot="header" style="display:contents">{@render header()}</div>{/if}
  {#if media}<div slot="media" style="display:contents">{@render media()}</div>{/if}
</lab-card>
