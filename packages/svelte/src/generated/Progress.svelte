<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/progress';
  import type { LabProgress } from '@labpics/ui-core/progress';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-progress> — типы взяты прямо из класса ядра (LabProgress). */
  interface Props {
    size?: LabProgress['size'];
    value?: LabProgress['value'];
    min?: LabProgress['min'];
    max?: LabProgress['max'];
    label?: LabProgress['label'];
    showValueText?: LabProgress['showValueText'];
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, value, min, max, label, showValueText, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'showValueText', attr: 'show-value-text', kind: 'boolean' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { size, value, min, max, label, showValueText })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { size, value, min, max, label, showValueText });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-progress bind:this={el} {...rest} {...initialBooleans}>
</lab-progress>
