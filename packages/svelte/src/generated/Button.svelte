<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/button';
  import type { LabButton } from '@labpics/ui-core/button';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-button> — типы взяты прямо из класса ядра (LabButton). */
  interface Props {
    type?: LabButton['type'];
    kind?: LabButton['kind'];
    size?: LabButton['size'];
    description?: LabButton['description'];
    icon?: LabButton['icon'];
    loading?: LabButton['loading'];
    disabled?: LabButton['disabled'];
    htmlType?: LabButton['htmlType'];
    end?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { type, kind, size, description, icon, loading, disabled, htmlType, children, end, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'kind', attr: 'kind', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'icon', attr: 'icon', kind: 'boolean' },
    { name: 'loading', attr: 'loading', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'htmlType', attr: 'html-type', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { type, kind, size, description, icon, loading, disabled, htmlType });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-button bind:this={el} {...rest}>
  {@render children?.()}
  {#if end}<div slot="end" style="display:contents">{@render end()}</div>{/if}
</lab-button>
