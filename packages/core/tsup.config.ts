import { fileURLToPath } from 'node:url';
import { libraryPreset } from '../../tsup.config.base';
import { discoverComponents } from './scripts/discover-components';

/**
 * Регистрацией владеет публичный src/components/<name>/index.ts. Его side effect
 * защищён в исходниках и dist. Вложенный компонент подключает зависимость через
 * @labpics/ui-core/<name>; external сохраняет этот вход отдельной границей сборки.
 * Относительный импорт соседнего index снова позволит перенести эффект в chunk.
 * Проверка packed consumer охватывает входы и вложенные зависимости.
 *
 * Корень, SSR и hydration остаются отдельными входами. Zag и Lit внешние, поэтому
 * потребитель дедуплицирует их. Новые компоненты обнаруживаются без списка здесь.
 */
const componentEntries = discoverComponents().map(({ entry }) => entry);
const configureEsbuild = libraryPreset().esbuildOptions;

export default libraryPreset({
  entry: [
    'src/index.ts',
    'src/shared.ts',
    'src/ssr/index.ts',
    'src/hydrate/index.ts',
    'src/motion/index.ts',
    'src/proof/lab-proof.ts',
    ...componentEntries,
  ],
  // tsup 8.3.6 теряет основание унаследованных paths при подготовке DTS options.
  dts: {
    compilerOptions: { baseUrl: fileURLToPath(new URL('../../', import.meta.url)) },
  },
  esbuildOptions(options, context) {
    configureEsbuild?.(options, context);
    // В CJS доступен штатный __filename. URL из неэкранированного пути ломает # и %.
    if (context.format === 'cjs') {
      options.define = { ...options.define, 'import.meta.url': 'undefined' };
    }
  },
  external: ['@labpics/ui-core', /^@zag-js\//, /^@lit-labs\//, 'lit'],
});
