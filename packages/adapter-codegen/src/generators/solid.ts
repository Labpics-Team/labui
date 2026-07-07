/**
 * Генератор Solid-обёрток: по одному `src/generated/<subpath>.ts` на компонент +
 * барель + аугментация `JSX.IntrinsicElements` для сырого использования `<lab-*>`.
 * Типы пропов — через `Pick<LabX, …>` (SSOT из класса ядра).
 */
import { join } from 'node:path';
import { adapterSrc } from '../paths.js';
import type { ComponentMeta, Manifest, PropMeta } from '../types.js';
import { generatedHeader, tsStringUnion, writeIfChanged } from './shared.js';

function specLiteral(p: PropMeta): string {
  return `    { name: '${p.name}', attr: '${p.attr}', kind: '${p.kind}' },`;
}

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
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <${c.tag}>, взятые прямо из класса ядра (${c.className}). */
export type ${c.pascal}Props = ${propsType};

/** <${c.pascal}> — тонкая Solid-обёртка над <${c.tag}>. */
export const ${c.pascal}: LabSolidComponent<${c.pascal}Props, ${events}> = createLabComponent<
  ${c.pascal}Props,
  ${events}
>('${c.tag}', {
  specs: [
${specs}
  ],
  events: [${c.events.map((e) => `'${e}'`).join(', ')}],
});
`;
}

function barrelFile(components: readonly ComponentMeta[]): string {
  const lines = components.map(
    (c) => `export { ${c.pascal}, type ${c.pascal}Props } from './${c.subpath}.js';`,
  );
  return `${generatedHeader()}\n${lines.join('\n')}\n`;
}

/** Генерирует все Solid-файлы. Возвращает список изменённых путей. */
export function generateSolid(manifest: Manifest): string[] {
  const outDir = join(adapterSrc('solid'), 'generated');
  const changed: string[] = [];
  for (const c of manifest.components) {
    const path = join(outDir, `${c.subpath}.ts`);
    if (writeIfChanged(path, componentFile(c))) changed.push(path);
  }
  const indexPath = join(outDir, 'index.ts');
  if (writeIfChanged(indexPath, barrelFile(manifest.components))) changed.push(indexPath);
  return changed;
}
