<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/kbd';
  import type { LabKbd } from '@labpics/ui-core/kbd';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-kbd> — типы взяты прямо из класса ядра (LabKbd). */
  interface Props {
    size?: LabKbd['size'];
    keys?: LabKbd['keys'];
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, keys, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'keys', attr: 'keys', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, keys });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-kbd bind:this={el} {...rest}>
  {@render children?.()}
</lab-kbd>
