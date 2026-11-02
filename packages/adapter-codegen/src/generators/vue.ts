/**
 * Генератор Vue-обёрток: по одному файлу `src/generated/<subpath>.ts` на компонент
 * + барель. Каждый файл декларирует типы пропов через `Pick<LabX, …>` (SSOT из
 * класса ядра — ноль ручного маппинга осей) и передаёт спеки в общую фабрику
 * `createLabComponent`. Вся логика проброса — в фабрике (см. create-lab-component.ts).
 */
import { join } from 'node:path';
import { adapterSrc } from '../paths.js';
import type { ComponentMeta, Manifest, PropMeta } from '../types.js';
import {
  generatedHeader,
  slotProjectionFile,
  tsStringArray,
  tsStringUnion,
  writeIfChanged,
} from './shared.js';

/** Литерал одной спеки проброса. */
function specLiteral(p: PropMeta): string {
  return `      { name: '${p.name}', attr: '${p.attr}', kind: '${p.kind}' },`;
}

/** Исходник одного сгенерированного Vue-файла. */
function componentFile(c: ComponentMeta): string {
  const propNames = c.props.map((p) => p.name);
  const pickKeys = propNames.map((n) => `'${n}'`).join(' | ');
  const propsType =
    propNames.length > 0 ? `Pick<${c.className}, ${pickKeys}>` : 'Record<never, never>';
  const events = tsStringUnion(c.events);
  const specs = c.props.map(specLiteral).join('\n');
  return `${generatedHeader()}
import '@labpics/ui-core/${c.subpath}';
import type { ${c.className} } from '@labpics/ui-core/${c.subpath}';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <${c.tag}>, взятые прямо из класса ядра (${c.className}). */
export type ${c.pascal}Props = ${propsType};

/**
 * <${c.pascal}> — тонкая Vue-обёртка над <${c.tag}>.${
   c.events.length > 0
     ? `\n * События: ${c.events.map((e) => `on${pascalizeEvent(e)}`).join(', ')}.`
     : ''
 }
 */
export const ${c.pascal}: LabComponent<${c.pascal}Props, ${events}> = createLabComponent<
  ${c.pascal}Props,
  ${events}
>('${c.tag}', {
  specs: [
${specs}
  ],
  events: ${tsStringArray(c.events)},
${c.slots.fill?.length ? `  fillSlots: ${tsStringArray(c.slots.fill)},\n` : ''}\
});
`;
}

/** kebab → Pascal для имени обработчика в комментарии. */
function pascalizeEvent(name: string): string {
  return name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** Барель всех сгенерированных компонентов. */
function barrelFile(components: readonly ComponentMeta[]): string {
  const lines = components.map(
    (c) => `export { ${c.pascal}, type ${c.pascal}Props } from './${c.subpath}.js';`,
  );
  return `${generatedHeader()}\n${lines.join('\n')}\n`;
}

/** Генерирует все Vue-файлы. Возвращает список изменённых путей. */
export function generateVue(manifest: Manifest): string[] {
  const outDir = join(adapterSrc('vue'), 'generated');
  const changed: string[] = [];
  const projectionPath = join(adapterSrc('vue'), 'runtime', 'slot-projection.ts');
  if (writeIfChanged(projectionPath, slotProjectionFile())) changed.push(projectionPath);
  for (const c of manifest.components) {
    const path = join(outDir, `${c.subpath}.ts`);
    if (writeIfChanged(path, componentFile(c))) changed.push(path);
  }
  const indexPath = join(outDir, 'index.ts');
  if (writeIfChanged(indexPath, barrelFile(manifest.components))) changed.push(indexPath);
  return changed;
}
