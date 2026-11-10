import { libraryPreset } from '../../tsup.config.base';

export default libraryPreset({
  // `.astro`-компоненты поставляются исходниками
  // (их компилирует Astro потребителя) и импортят собранный хелпер как @labpics/ui-astro/ssr.
  entry: { ssr: 'src/ssr.ts', hydrate: 'src/hydrate.ts' },
  platform: 'node',
  // Ядро и @lit-labs/ssr — внешние: движок SSR резолвится из @labpics/ui-core.
  external: [/^@labpics\//, /^@lit-labs\//],
});
