<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/avatar';
  import type { LabAvatar } from '@labpics/ui-core/avatar';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-avatar> — типы взяты прямо из класса ядра (LabAvatar). */
  interface Props {
    size?: LabAvatar['size'];
    color?: LabAvatar['color'];
    status?: LabAvatar['status'];
    src?: LabAvatar['src'];
    name?: LabAvatar['name'];
    initials?: LabAvatar['initials'];
    fallback?: LabAvatar['fallback'];
    decorative?: LabAvatar['decorative'];
    statusLabel?: LabAvatar['statusLabel'];
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { size, color, status, src, name, initials, fallback, decorative, statusLabel, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'color', attr: 'color', kind: 'string' },
    { name: 'status', attr: 'status', kind: 'string' },
    { name: 'src', attr: 'src', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'initials', attr: 'initials', kind: 'string' },
    { name: 'fallback', attr: 'fallback', kind: 'string' },
    { name: 'decorative', attr: 'decorative', kind: 'boolean' },
    { name: 'statusLabel', attr: 'status-label', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-avatar', {
    specs, props: { size, color, status, src, name, initials, fallback, decorative, statusLabel }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-avatar bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { size, color, status, src, name, initials, fallback, decorative, statusLabel } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-avatar>
