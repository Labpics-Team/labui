<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/badge';
  import type { LabBadge } from '@labpics/ui-core/badge';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';
  import { slotFillMarkup } from '../runtime/slot-projection.js';

  /** Пропы <lab-badge> — типы взяты прямо из класса ядра (LabBadge). */
  interface Props {
    color?: LabBadge['color'];
    type?: LabBadge['type'];
    disabled?: LabBadge['disabled'];
    dot?: Snippet;
    leading?: Snippet;
    trailing?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { color, type, disabled, children, dot, leading, trailing, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'color', attr: 'color', kind: 'string' },
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { color, type, disabled });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-badge bind:this={el} {...rest}>
  {#if dot || leading || trailing}{@html slotFillMarkup}{/if}
  {@render children?.()}
  {#if dot}<span slot="dot" data-lab-slot-fill style="display:inline-flex">{@render dot()}</span>{/if}
  {#if leading}<span slot="leading" data-lab-slot-fill style="display:inline-flex">{@render leading()}</span>{/if}
  {#if trailing}<span slot="trailing" data-lab-slot-fill style="display:inline-flex">{@render trailing()}</span>{/if}
</lab-badge>
