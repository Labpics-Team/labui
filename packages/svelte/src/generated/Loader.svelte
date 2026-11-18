<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/loader';
  import type { LabLoader } from '@labpics/ui-core/loader';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-loader> — типы взяты прямо из класса ядра (LabLoader). */
  interface Props {
    size?: LabLoader['size'];
    label?: LabLoader['label'];
    value?: LabLoader['value'];
    min?: LabLoader['min'];
    max?: LabLoader['max'];
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, label, value, min, max, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, label, value, min, max });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-loader bind:this={el} {...rest}>
</lab-loader>
