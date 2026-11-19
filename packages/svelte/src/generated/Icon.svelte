<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/icon';
  import type { LabIcon } from '@labpics/ui-core/icon';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-icon> — типы взяты прямо из класса ядра (LabIcon). */
  interface Props {
    symbol?: LabIcon['symbol'];
    variant?: LabIcon['variant'];
    size?: LabIcon['size'];
    scale?: LabIcon['scale'];
    weight?: LabIcon['weight'];
    opsz?: LabIcon['opsz'];
    state?: LabIcon['state'];
    date?: LabIcon['date'];
    timeZone?: LabIcon['timeZone'];
    duration?: LabIcon['duration'];
    reducedMotion?: LabIcon['reducedMotion'];
    effect?: LabIcon['effect'];
    effectKey?: LabIcon['effectKey'];
    label?: LabIcon['label'];
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { symbol, variant, size, scale, weight, opsz, state, date, timeZone, duration, reducedMotion, effect, effectKey, label, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'symbol', attr: 'symbol', kind: 'prop' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'prop' },
    { name: 'scale', attr: 'scale', kind: 'prop' },
    { name: 'weight', attr: 'weight', kind: 'string' },
    { name: 'opsz', attr: 'opsz', kind: 'prop' },
    { name: 'state', attr: 'state', kind: 'string' },
    { name: 'date', attr: 'date', kind: 'prop' },
    { name: 'timeZone', attr: 'time-zone', kind: 'string' },
    { name: 'duration', attr: 'duration', kind: 'string' },
    { name: 'reducedMotion', attr: 'reduced-motion', kind: 'boolean' },
    { name: 'effect', attr: 'effect', kind: 'string' },
    { name: 'effectKey', attr: 'effectKey', kind: 'prop' },
    { name: 'label', attr: 'label', kind: 'string' },
  ];

  const server = untrack(() => renderElementParts('lab-icon', {
    specs, props: { symbol, variant, size, scale, weight, opsz, state, date, timeZone, duration, reducedMotion, effect, effectKey, label }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, {  }));
</script>

<lab-icon bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { symbol, variant, size, scale, weight, opsz, state, date, timeZone, duration, reducedMotion, effect, effectKey, label } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<div {...{ slot: name }} style="display:contents">{@render content()}</div>{/if}
  {/each}
</lab-icon>
