import { libraryPreset } from '../../tsup.config.base';

export default libraryPreset({
  // Собираем только SSR-хелперы (renderX). `.astro`-компоненты шиппятся ИСХОДНИКАМИ
  // (их компилирует Astro потребителя) и импортят собранный хелпер как @labpics/ui-astro/ssr.
  entry: { ssr: 'src/ssr.ts' },
  // Ядро и @lit-labs/ssr — внешние: движок SSR резолвится из @labpics/ui-core.
  external: [/^@labpics\//, /^@lit-labs\//],
});
