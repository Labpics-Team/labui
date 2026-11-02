/**
 * Генератор Svelte 5-обёрток: по одному `src/generated/<Pascal>.svelte` на компонент
 * + барель-`index.ts` (реэкспорт). Svelte-библиотека распространяется исходными
 * `.svelte` (компилирует потребитель через svelte-package).
 *
 * Проброс: начальные Boolean-пропы до вставки узла, обновления → forwardDeclared
 * (по тем же спекам, camelCase→нужный атрибут),
 * события → forwardEvents (on:-директивы избегаем — deprecated в Svelte 5; вешаем
 * addEventListener в $effect), статические именованные слоты → snippet-пропы,
 * контент по умолчанию → {@render children}. Нативные атрибуты → {...rest}.
 */
import { join } from 'node:path';
import { adapterSrc } from '../paths.js';
import type { ComponentMeta, Manifest, PropMeta } from '../types.js';
import { generatedHeader, writeIfChanged } from './shared.js';

/** kebab → PascalCase: 'value-change' → 'ValueChange'. */
function pascal(name: string): string {
  return name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** kebab → camelCase: 'icon-on' → 'iconOn' (имя snippet-пропа для слота). */
function camel(name: string): string {
  const p = pascal(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Имя обработчика события: 'value-change' → 'onValueChange'. */
function handlerName(event: string): string {
  return `on${pascal(event)}`;
}

function specLiteral(p: PropMeta): string {
  return `    { name: '${p.name}', attr: '${p.attr}', kind: '${p.kind}' },`;
}

function componentFile(c: ComponentMeta): string {
  const propNames = c.props.map((p) => p.name);
  const handlerNames = c.events.map(handlerName);
  const propNameSet = new Set(propNames);
  // Именованные слоты → snippet-пропы (camelCase-имя → kebab-слот). Слот, чьё имя
  // совпадает с одноимённым пропом (напр. tooltip: проп content + слот content), из
  // типизированных snippet-пропов ИСКЛЮЧАЕМ — иначе коллизия в едином Props-интерфейсе
  // (проп string vs snippet). Проп покрывает строковый случай; rich-контент потребитель
  // передаёт light-DOM детьми с атрибутом slot="content".
  const namedSlots = c.slots.named
    .filter((slot) => !propNameSet.has(camel(slot)))
    .map((slot) => ({ slot, prop: camel(slot) }));

  const propDecls = c.props.map((p) => `    ${p.name}?: ${c.className}['${p.name}'];`).join('\n');
  const eventDecls = handlerNames.map((h) => `    ${h}?: (event: CustomEvent) => void;`).join('\n');
  const slotDecls = namedSlots.map((s) => `    ${s.prop}?: Snippet;`).join('\n');

  // children деструктурируем ВСЕГДA (иначе Snippet ушёл бы в ...rest и спреднулся
  // атрибутом); рендерим только при наличии default/динамического слота.
  const destructure = [...propNames, ...handlerNames, 'children', ...namedSlots.map((s) => s.prop)];
  const valuesObj = propNames.join(', ');
  const eventsObj = c.events.map((e) => `'${e}': ${handlerName(e)}`).join(', ');
  const specs = c.props.map(specLiteral).join('\n');
  const hasBooleans = c.props.some((p) => p.kind === 'boolean');
  const initialBooleans = hasBooleans
    ? `
  // Клиентский snapshot заполняется до вставки узла и больше не меняется.
  // SSR-компилятор исключает предэффект; серверный рендер выполняет /ssr.
  const initialBooleans: Record<string, boolean> = {};
  $effect.pre(() => {
    Object.assign(initialBooleans, untrack(() => initialBooleanProps(specs, { ${valuesObj} })));
  });
`
    : '';

  const namedSlotMarkup = namedSlots
    .map(
      (s) =>
        `  {#if ${s.prop}}<div slot="${s.slot}" style="display:contents">{@render ${s.prop}()}</div>{/if}`,
    )
    .join('\n');
  const renderChildren = c.slots.default || c.slots.dynamic;
  const childrenMarkup = renderChildren ? '\n  {@render children?.()}' : '';

  const propsBlock = [propDecls, eventDecls, slotDecls, '    children?: Snippet;']
    .filter((s) => s.length > 0)
    .join('\n');

  return `${generatedHeader('line')}
<script lang="ts">
  import '@labpics/ui-core/${c.subpath}';
  import type { ${c.className} } from '@labpics/ui-core/${c.subpath}';
  import { type Snippet${hasBooleans ? ', untrack' : ''} } from 'svelte';
  import { type LabPropSpec, ${hasBooleans ? 'initialBooleanProps, ' : ''}forwardDeclared, forwardEvents } from '../runtime/forward.js';

  /** Пропы <${c.tag}> — типы взяты прямо из класса ядра (${c.className}). */
  interface Props {
${propsBlock}
    [key: string]: unknown;
  }

  let { ${destructure.join(', ')}, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
${specs}
  ];

  let el: HTMLElement | undefined = $state();
${initialBooleans}

  $effect(() => {
    forwardDeclared(el, specs, { ${valuesObj} });
  });
  $effect(() => forwardEvents(el, { ${eventsObj} }));
</script>

<${c.tag} bind:this={el} {...rest}${hasBooleans ? ' {...initialBooleans}' : ''}>${childrenMarkup}${namedSlotMarkup ? `\n${namedSlotMarkup}` : ''}
</${c.tag}>
`;
}

function barrelFile(components: readonly ComponentMeta[]): string {
  const lines = components.map(
    (c) => `export { default as ${c.pascal} } from './${c.pascal}.svelte';`,
  );
  return `${generatedHeader()}\n${lines.join('\n')}\n`;
}

/** Генерирует все Svelte-файлы. Возвращает список изменённых путей. */
export function generateSvelte(manifest: Manifest): string[] {
  const outDir = join(adapterSrc('svelte'), 'generated');
  const changed: string[] = [];
  for (const c of manifest.components) {
    const path = join(outDir, `${c.pascal}.svelte`);
    if (writeIfChanged(path, componentFile(c))) changed.push(path);
  }
  const indexPath = join(outDir, 'index.ts');
  if (writeIfChanged(indexPath, barrelFile(manifest.components))) changed.push(indexPath);
  return changed;
}
