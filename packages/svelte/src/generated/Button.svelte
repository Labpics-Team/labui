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

  let { type: prop_type, kind: prop_kind, size: prop_size, icon: prop_icon, loading: prop_loading, disabled: prop_disabled, htmlType: prop_htmlType, children, slots, description: slot_description, iconEnd: slot_iconEnd, ...rest }: Props = $props();

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
    specs, props: { type: prop_type, kind: prop_kind, size: prop_size, icon: prop_icon, loading: prop_loading, disabled: prop_disabled, htmlType: prop_htmlType }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ 'description': slot_description, 'icon-end': slot_iconEnd, ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-button bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { type: prop_type, kind: prop_kind, size: prop_size, icon: prop_icon, loading: prop_loading, disabled: prop_disabled, htmlType: prop_htmlType } } }}>
  {@html server?.shadowHtml ?? ''}
  {@render children?.()}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-button>
