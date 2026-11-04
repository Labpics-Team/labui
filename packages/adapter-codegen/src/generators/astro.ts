/**
 * Генератор Astro-компонентов. `@astrojs/lit` УСТАРЕЛ на Astro 5 (офиц. доки), поэтому
 * используем ручной рецепт Lit SSR: `.astro` серверно рендерит DSD через общую
 * SSR-функцию `renderX` (см. generators/ssr.ts) и внедряет её `set:html`; клиентский
 * `<script>` регистрирует элемент. Интеграция @labpics/ui-astro/hydrate заранее
 * устанавливает поддержку гидратации на уровне документа.
 *
 * SSR-функции живут в `@labpics/ui-astro/ssr` (общий ssr-генератор), здесь — только
 * тонкие `.astro`-обёртки над ними.
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

function astroFile(c: ComponentMeta): string {
  const slotEntries: Array<{ key: string; name: string }> = [
    ...(c.slots.default ? [{ key: 'default', name: 'default' }] : []),
    ...c.slots.named.map((s) => ({ key: camelSlot(s), name: s })),
  ];
  const slotLines = slotEntries
    .map(
      (s) =>
        `  ${s.key}: Astro.slots.has('${s.name}') ? await Astro.slots.render('${s.name}') : undefined,`,
    )
    .join('\n');
  const slotsArg = slotEntries.length > 0 ? `{\n${slotLines}\n}` : '{}';

  return `---
${generatedHeader()}
import { render${c.pascal} } from '@labpics/ui-astro/ssr';

if (!import.meta.env.LABUI_HYDRATE) {
  throw new Error('LabUI SSR: добавьте hydrate() из @labpics/ui-astro/hydrate в integrations в astro.config.');
}

const dsd = render${c.pascal}(Astro.props, ${slotsArg});
---
<Fragment set:html={dsd} />
<script>
  import '@labpics/ui-core/${c.subpath}';
</script>
`;
}

/** Генерирует `.astro`-компоненты. Возвращает изменённые пути. */
export function generateAstro(manifest: Manifest): string[] {
  const astroDir = join(adapterSrc('astro'), 'astro');
  const changed: string[] = [];
  for (const c of manifest.components) {
    const path = join(astroDir, `${c.pascal}.astro`);
    if (writeIfChanged(path, astroFile(c))) changed.push(path);
  }
  return changed;
}
