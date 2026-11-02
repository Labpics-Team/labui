/**
 * Общий генератор SSR-функций `renderX` (одинаковы для всех фреймворков — они
 * фреймворк-АГНОСТИЧНЫ: строят Lit-шаблон `<lab-*>` и рендерят в declarative-shadow-DOM
 * строку через ядро). По одному `src/generated/<subpath>.ssr.ts` на компонент + барель
 * `ssr.ts`. Каждый адаптер даёт вход `@labpics/ui-<fw>/ssr`, реэкспортящий барель.
 *
 * `@labpics/ui-core/ssr` использует минимальный DOM Lit и общий registry.
 * Регистрация элемента обязательна: @lit-labs/ssr эмитит shadow root только
 * известных элементов. Обычный static import собранного входа проверяется
 * в ssr-entry.test.ts без прогрева окружения тестовым раннером.
 */
import { join } from 'node:path';
import { adapterSrc } from '../paths.js';
import type { ComponentMeta, Manifest } from '../types.js';
import { generatedHeader, slotFillMarkup, writeIfChanged } from './shared.js';

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
  if (kind === 'prop') return `      .${name}=\${props.${name}}`;
  if (kind === 'boolean') {
    return `      .${name}=\${props.${name} === undefined ? noChange : Boolean(props.${name})}`;
  }
  return `      ${attr}=\${ifDefined(props.${name})}`;
}

function ssrFile(c: ComponentMeta): string {
  const propNames = c.props.map((p) => p.name);
  const pickKeys = propNames.map((n) => `'${n}'`).join(' | ');
  const propsType =
    propNames.length > 0 ? `Partial<Pick<${c.className}, ${pickKeys}>>` : 'Record<never, never>';
  const bindings = c.props.map((p) => bindingLine(p.name, p.attr, p.kind)).join('\n');

  const slotKeys = [
    ...(c.slots.default ? ['default'] : []),
    ...c.slots.named.map((s) => camelSlot(s)),
  ];
  const slotsType =
    slotKeys.length > 0
      ? `{ ${slotKeys.map((k) => `${k}?: string`).join('; ')} }`
      : 'Record<never, never>';

  const hasSlots = slotKeys.length > 0;
  const namedSlotParts = c.slots.named
    .map((s) =>
      c.slots.fill?.includes(s)
        ? `\${slots.${camelSlot(s)} ? html\`<span slot="${s}" data-lab-slot-fill style="display:inline-flex">\${unsafeHTML(slots.${camelSlot(s)})}</span>\` : ''}`
        : `\${slots.${camelSlot(s)} ? html\`<span slot="${s}">\${unsafeHTML(slots.${camelSlot(s)})}</span>\` : ''}`,
    )
    .join('');
  const defaultSlotPart = c.slots.default ? "${unsafeHTML(slots.default ?? '')}" : '';
  const fillCondition = c.slots.fill?.map((s) => `slots.${camelSlot(s)}`).join(' || ');
  const fillStyle = fillCondition ? `\${${fillCondition} ? html\`${slotFillMarkup}\` : ''}` : '';
  const children = `${fillStyle}${namedSlotParts}${defaultSlotPart}`;
  // Параметр slots — только когда есть слоты (иначе noUnusedParameters).
  const slotsParam = hasSlots ? `\n  slots: ${c.pascal}SsrSlots = {},` : '';

  // Условные импорты из единой SSR-поверхности ядра (адаптер зависит только от core,
  // не от lit напрямую). Базовый tsconfig включает noUnusedLocals — берём лишь нужное.
  const usesIfDefined = c.props.some((p) => p.kind === 'string');
  const usesNoChange = c.props.some((p) => p.kind === 'boolean');
  const usesUnsafeHtml = c.slots.default || c.slots.named.length > 0;
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
export type ${c.pascal}SsrProps = ${propsType};
/** SSR-слоты <${c.tag}> — предрендеренные строки контента. */
export type ${c.pascal}SsrSlots = ${slotsType};

/**
 * Рендерит <${c.tag}> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
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
