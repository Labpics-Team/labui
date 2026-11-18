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

  /** Пропы <lab-badge> — типы взяты прямо из класса ядра (LabBadge). */
  interface Props {
    color?: LabBadge['color'];
    type?: LabBadge['type'];
    disabled?: LabBadge['disabled'];
    dot?: Snippet;
    icon?: Snippet;
    iconEnd?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { color, type, disabled, children, dot, icon, iconEnd, ...rest }: Props = $props();

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
  {@render children?.()}
  {#if dot}<div slot="dot" style="display:contents">{@render dot()}</div>{/if}
  {#if icon}<div slot="icon" style="display:contents">{@render icon()}</div>{/if}
  {#if iconEnd}<div slot="icon-end" style="display:contents">{@render iconEnd()}</div>{/if}
</lab-badge>
