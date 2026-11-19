<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/badge';
  import type { LabBadge } from '@labpics/ui-core/badge';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-badge> — типы взяты прямо из класса ядра (LabBadge). */
  interface Props {
    color?: LabBadge['color'];
    type?: LabBadge['type'];
    disabled?: LabBadge['disabled'];
    dot?: Snippet;
    icon?: Snippet;
    iconEnd?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { color, type, disabled, children, slots, dot, icon, iconEnd, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'color', attr: 'color', kind: 'string' },
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
  ];

  const server = untrack(() => renderElementParts('lab-badge', {
    specs, props: { color, type, disabled }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'dot': dot, 'icon': icon, 'icon-end': iconEnd, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { color, type, disabled });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-badge bind:this={el} {...server?.attributes} {...rest}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-badge>
