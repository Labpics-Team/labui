<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/avatar';
  import type { LabAvatar } from '@labpics/ui-core/avatar';
  import type { Snippet } from 'svelte';
  import { type LabPropSpec, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-avatar> — типы взяты прямо из класса ядра (LabAvatar). */
  interface Props {
    size?: LabAvatar['size'];
    color?: LabAvatar['color'];
    status?: LabAvatar['status'];
    src?: LabAvatar['src'];
    name?: LabAvatar['name'];
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, color, status, src, name, children, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'color', attr: 'color', kind: 'string' },
    { name: 'status', attr: 'status', kind: 'string' },
    { name: 'src', attr: 'src', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    forwardDeclared(el, specs, { size, color, status, src, name });
  });
  $effect(() => forwardEvents(el, {  }));
</script>

<lab-avatar bind:this={el} {...rest}>
</lab-avatar>
