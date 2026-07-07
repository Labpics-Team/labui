import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libraryPreset } from '../../tsup.config.base';

const here = dirname(fileURLToPath(import.meta.url));
const genDir = join(here, 'src', 'generated');

/**
 * Per-component входы клиентских обёрток, АВТО-обнаруженные из `src/generated/<name>.ts`.
 * Барели (index/ssr) и SSR-функции (*.ssr.ts) идут отдельными входами, не дублируем.
 * Каждый компонент — свой вход, чтобы потребитель импортировал `@labpics/ui-solid/<name>`
 * и подтянул только его (tree-shaking-шов, как в @labpics/ui-react).
 */
const componentEntries = Object.fromEntries(
  readdirSync(genDir)
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.ssr.ts') &&
        file !== 'index.ts' &&
        file !== 'ssr.ts',
    )
    .map((file) => [file.slice(0, -'.ts'.length), `src/generated/${file}`]),
);

export default libraryPreset({
  entry: {
    index: 'src/index.ts',
    ssr: 'src/ssr.ts',
    ...componentEntries,
  },
  splitting: false,
  // Solid и Lit-ядро — внешние: приложение потребителя владеет Solid, рантайм <lab-*>
  // резолвится один раз из @labpics/ui-core. Обёртка написана на рантайм-примитивах
  // Solid (без JSX), поэтому компилятор Solid потребителю для этого пакета не нужен.
  external: ['solid-js', 'solid-js/web', /^@labpics\//, /^@lit-labs\//],
});
