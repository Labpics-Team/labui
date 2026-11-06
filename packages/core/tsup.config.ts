import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { libraryPreset } from '../../tsup.config.base';
import packageManifest from './package.json' with { type: 'json' };
import { discoverComponents } from './scripts/discover-components';

/**
 * Регистрацией владеет публичный src/components/<name>/index.ts. Его side effect
 * защищён в исходниках и dist. Вложенный компонент подключает зависимость через
 * @labpics/ui-core/<name>; external сохраняет этот вход отдельной границей сборки.
 * Относительный импорт соседнего index снова позволит перенести эффект в chunk.
 * Проверка packed consumer охватывает входы и вложенные зависимости.
 *
 * Корень, SSR и hydration остаются отдельными входами. Lit внешний. Поведения Zag
 * входят в Core: поправки владельца доставляются в tarball. WC и React читают
 * public Behaviors boundary; copy-artifacts связывает её ESM/CJS входы с одним
 * CJS runtime, включая dismissable, focus, aria-hidden и scroll locks.
 */
const componentEntries = discoverComponents().map(({ entry }) => entry);
const behaviorEntries = readdirSync(new URL('./src/behaviors', import.meta.url))
  .filter((name) => name.endsWith('.ts') && name !== 'types.ts')
  .sort()
  .map((name) => `src/behaviors/${name}`);
const configureEsbuild = libraryPreset().esbuildOptions;
const bundledZagTypes = Object.keys(packageManifest.devDependencies).filter((name) =>
  name.startsWith('@zag-js/'),
);

export default libraryPreset({
  entry: [
    'src/index.ts',
    'src/shared.ts',
    'src/ssr/index.ts',
    'src/hydrate/index.ts',
    'src/motion/index.ts',
    'src/proof/lab-proof.ts',
    ...behaviorEntries,
    ...componentEntries,
  ],
  // CJS также разделяет runtime между входами; отдельный bundle создаст второй stack.
  splitting: true,
  metafile: true,
  // tsup 8.3.6 теряет основание унаследованных paths при подготовке DTS options.
  dts: {
    // Runtime и типы build dependencies входят в Core, включая исправления Popper.
    // Production/peer dependencies сохраняют canonical Service/Collection identity.
    resolve: bundledZagTypes,
    compilerOptions: { baseUrl: fileURLToPath(new URL('../../', import.meta.url)) },
  },
  esbuildOptions(options, context) {
    configureEsbuild?.(options, context);
    // В CJS доступен штатный __filename. URL из неэкранированного пути ломает # и %.
    if (context.format === 'cjs') {
      options.define = { ...options.define, 'import.meta.url': 'undefined' };
    }
  },
  external: ['@labpics/ui-core', /^@lit-labs\//, 'lit'],
  // Публичные типы Floating UI имеют прямую dependency; JS сохраняет прежний bundle.
  noExternal: [/^@zag-js\//, '@floating-ui/dom'],
});
