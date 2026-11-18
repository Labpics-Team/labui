<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/tabs';
  import type { LabTabs } from '@labpics/ui-core/tabs';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-tabs> — типы взяты прямо из класса ядра (LabTabs). */
  interface Props {
    variant?: LabTabs['variant'];
    edge?: LabTabs['edge'];
    orientation?: LabTabs['orientation'];
    size?: LabTabs['size'];
    activationMode?: LabTabs['activationMode'];
    value?: LabTabs['value'];
    defaultValue?: LabTabs['defaultValue'];
    label?: LabTabs['label'];
    dir?: LabTabs['dir'];
    items?: LabTabs['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { variant, edge, orientation, size, activationMode, value, defaultValue, label, dir, items, onValueChange, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'edge', attr: 'edge', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'activationMode', attr: 'activation-mode', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'dir', attr: 'dir', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { variant, edge, orientation, size, activationMode, value, defaultValue, label, dir, items });
  });
  $effect(() => forwardEvents(el, { 'value-change': onValueChange }));
</script>

<lab-tabs bind:this={el} {...rest}>
  {@render children?.()}
</lab-tabs>
