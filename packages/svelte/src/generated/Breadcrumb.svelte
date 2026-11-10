<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/breadcrumb';
  import type { LabBreadcrumb } from '@labpics/ui-core/breadcrumb';
  import { type Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-breadcrumb> — типы взяты прямо из класса ядра (LabBreadcrumb). */
  interface Props {
    size?: LabBreadcrumb['size'];
    separator?: LabBreadcrumb['separator'];
    items?: LabBreadcrumb['items'];
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, separator, items, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'separator', attr: 'separator', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();


  $effect(() => {
    forwardDeclared(el, specs, { size, separator, items });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-breadcrumb bind:this={el} {...rest}>
</lab-breadcrumb>
