<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/dialog';
  import type { LabDialog } from '@labpics/ui-core/dialog';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-dialog> — типы взяты прямо из класса ядра (LabDialog). */
  interface Props {
    modal?: LabDialog['modal'];
    closable?: LabDialog['closable'];
    heading?: LabDialog['heading'];
    description?: LabDialog['description'];
    size?: LabDialog['size'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    trigger?: Snippet<[{ readonly slot: 'trigger' }]>;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { modal, closable, heading, description, size, onOpenChange, children, content, trigger, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'modal', attr: 'modal', kind: 'string' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { modal, closable, heading, description, size })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { modal, closable, heading, description, size });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-dialog bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
  {#if content}<div slot="content" style="display:contents">{@render content()}</div>{/if}
  {#if trigger}{@render trigger({ slot: 'trigger' })}{/if}
</lab-dialog>
