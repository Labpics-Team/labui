<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/button';
  import type { LabButton } from '@labpics/ui-core/button';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-button> — типы взяты прямо из класса ядра (LabButton). */
  interface Props {
    type?: LabButton['type'];
    kind?: LabButton['kind'];
    size?: LabButton['size'];
    icon?: LabButton['icon'];
    loading?: LabButton['loading'];
    disabled?: LabButton['disabled'];
    htmlType?: LabButton['htmlType'];
    description?: Snippet;
    iconEnd?: Snippet;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { type, kind, size, icon, loading, disabled, htmlType, children, slots, description, iconEnd, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'kind', attr: 'kind', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'icon', attr: 'icon', kind: 'boolean' },
    { name: 'loading', attr: 'loading', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'htmlType', attr: 'html-type', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-button', {
    specs, props: { type, kind, size, icon, loading, disabled, htmlType }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'description': description, 'icon-end': iconEnd, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-button bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type, kind, size, icon, loading, disabled, htmlType } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-button>
