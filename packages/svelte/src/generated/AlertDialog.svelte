<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import '@labpics/ui-core/alert-dialog';
  import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';
  import { type Snippet, untrack } from 'svelte';
  import { type LabPropSpec, initialBooleanProps, forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <lab-alert-dialog> — типы взяты прямо из класса ядра (LabAlertDialog). */
  interface Props {
    size?: LabAlertDialog['size'];
    modal?: LabAlertDialog['modal'];
    closable?: LabAlertDialog['closable'];
    heading?: LabAlertDialog['heading'];
    description?: LabAlertDialog['description'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size, modal, closable, heading, description, onOpenChange, children, content, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'modal', attr: 'modal', kind: 'string' },
    { name: 'closable', attr: 'closable', kind: 'boolean' },
    { name: 'heading', attr: 'heading', kind: 'string' },
    { name: 'description', attr: 'description', kind: 'string' },
  ];

  let el: HTMLElement | undefined = $state();

  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { size, modal, closable, heading, description })));
  });


  $effect(() => {
    forwardDeclared(el, specs, { size, modal, closable, heading, description });
  });
  $effect(() => forwardEvents(el, { 'open-change': onOpenChange }));
</script>

<lab-alert-dialog bind:this={el} {...rest} {...initialBooleans}>
  {@render children?.()}
  {#if content}<div slot="content" style="display:contents">{@render content()}</div>{/if}
</lab-alert-dialog>
