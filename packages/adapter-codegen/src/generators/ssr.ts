/**
 * Общий генератор SSR-функций `renderX` (одинаковы для всех фреймворков — они
 * фреймворк-АГНОСТИЧНЫ: строят Lit-шаблон `<lab-*>` и рендерят в declarative-shadow-DOM
 * строку через ядро). По одному `src/generated/<subpath>.ssr.ts` на компонент + барель
 * `ssr.ts`. Каждый адаптер даёт вход `@labpics/ui-<fw>/ssr`, реэкспортящий барель.
 *
 * Порядок импортов load-bearing: `@labpics/ui-core/ssr` ставит DOM-шим ПЕРВЫМ, только
 * потом импортится модуль элемента (иначе `LitElement extends HTMLElement` упал бы —
 * в Node нет HTMLElement до шима). Регистрация элемента обязательна: @lit-labs/ssr
 * эмитит shadow root только известных элементов.
 */
import { join } from 'node:path';
import { adapterSrc } from '../paths.js';
import type { ComponentMeta, Manifest } from '../types.js';
import { generatedHeader, writeIfChanged } from './shared.js';

/** camelCase имя ключа слота: 'icon-on' → 'iconOn'. */
function camelSlot(name: string): string {
  const p = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Привязка одного пропа в Lit-шаблоне по его виду. */
function bindingLine(name: string, attr: string, kind: string): string {
  if (kind === 'prop' || kind === 'boolean')
    return `      .${name}=\${props.${name} === undefined ? noChange : props.${name}}`;
  return `      ${attr}=\${ifDefined(props.${name})}`;
}

function ssrFile(c: ComponentMeta): string {
  const propNames = c.props.map((p) => p.name);
  const pickKeys = propNames.map((n) => `'${n}'`).join(' | ');
  const propsType =
    propNames.length > 0 ? `Partial<Pick<${c.className}, ${pickKeys}>>` : 'Record<never, never>';
  // Client adapters forward native host attributes. Server rendering must retain
  // the accessible name and form association before custom-element hydration.
  const hostAttributes = ['aria-label', 'form'].filter(
    (attribute) => !c.props.some((prop) => prop.attr === attribute),
  );
  const hostPropsType = hostAttributes.length
    ? ` & { ${hostAttributes.map((attribute) => `'${attribute}'?: string`).join('; ')} }`
    : '';
  const bindings = [
    ...c.props.map((p) => bindingLine(p.name, p.attr, p.kind)),
    ...hostAttributes.map((attribute) => `      ${attribute}=\${ifDefined(props['${attribute}'])}`),
  ].join('\n');

  const slotKeys = [
    ...(c.slots.default || c.slots.dynamic ? ['default'] : []),
    ...c.slots.named.map((s) => camelSlot(s)),
  ];
  const slotFields = [
    ...slotKeys.map((k) => `${k}?: string`),
    ...(c.slots.dynamic ? ['dynamic?: Readonly<Record<string, string>>'] : []),
  ];
  const slotsType = slotFields.length > 0 ? `{ ${slotFields.join('; ')} }` : 'Record<never, never>';

  const hasSlots = slotFields.length > 0;
  const namedSlotParts = c.slots.named
    .map(
      (s) =>
        `\${slots.${camelSlot(s)} ? html\`<span slot="${s}">\${unsafeHTML(slots.${camelSlot(s)})}</span>\` : ''}`,
    )
    .join('');
  const defaultSlotPart =
    c.slots.default || c.slots.dynamic ? "${unsafeHTML(slots.default ?? '')}" : '';
  const dynamicSlotPart = c.slots.dynamic
    ? '${Object.entries(slots.dynamic ?? {}).map(([name, content]) => html`<span slot=${name}>${unsafeHTML(content)}</span>`)}'
    : '';
  const children = `${namedSlotParts}${dynamicSlotPart}${defaultSlotPart}`;
  // Параметр slots — только когда есть слоты (иначе noUnusedParameters).
  const slotsParam = hasSlots ? `\n  slots: ${c.pascal}SsrSlots = {},` : '';

  // Условные импорты из единой SSR-поверхности ядра (адаптер зависит только от core,
  // не от lit напрямую). Базовый tsconfig включает noUnusedLocals — берём лишь нужное.
  const usesIfDefined = hostAttributes.length > 0 || c.props.some((p) => p.kind === 'string');
  const usesNoChange = c.props.some((p) => p.kind === 'prop' || p.kind === 'boolean');
  const usesUnsafeHtml = hasSlots;
  const coreImports = [
    'html',
    'renderToString',
    usesIfDefined ? 'ifDefined' : '',
    usesNoChange ? 'noChange' : '',
    usesUnsafeHtml ? 'unsafeHTML' : '',
  ].filter(Boolean);

  return `${generatedHeader()}
import { ${coreImports.join(', ')} } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/${c.subpath}';
import type { ${c.className} } from '@labpics/ui-core/${c.subpath}';

/** SSR-пропы <${c.tag}> (атрибуты/свойства), взяты из класса ядра (${c.className}). */
export type ${c.pascal}SsrProps = ${propsType}${hostPropsType};
/** SSR-слоты <${c.tag}> — предрендеренные строки контента. */
export type ${c.pascal}SsrSlots = ${slotsType};

/**
 * Рендерит <${c.tag}> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function render${c.pascal}(
  props: ${c.pascal}SsrProps = {},${slotsParam}
): string {
  return renderToString(html\`<${c.tag}
${bindings}
    >${children}</${c.tag}>\`);
}
`;
}

function barrel(components: readonly ComponentMeta[]): string {
  const lines = components.map(
    (c) =>
      `export { render${c.pascal}, type ${c.pascal}SsrProps, type ${c.pascal}SsrSlots } from './${c.subpath}.ssr.js';`,
  );
  return `${generatedHeader()}\n${lines.join('\n')}\n`;
}

/**
 * Генерирует SSR-файлы в `packages/<framework>/src/generated`. Возвращает изменённые пути.
 */
export function generateSsr(framework: string, manifest: Manifest): string[] {
  const outDir = join(adapterSrc(framework), 'generated');
  const changed: string[] = [];
  for (const c of manifest.components) {
    const path = join(outDir, `${c.subpath}.ssr.ts`);
    if (writeIfChanged(path, ssrFile(c))) changed.push(path);
  }
  const barrelPath = join(outDir, 'ssr.ts');
  if (writeIfChanged(barrelPath, barrel(manifest.components))) changed.push(barrelPath);
  return changed;
}
