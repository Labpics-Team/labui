import hydrate from '@labpics/ui-astro/hydrate';
import { build } from 'astro';

await build({
  root: new URL('.', import.meta.url),
  outDir: process.argv[2],
  configFile: false,
  integrations: [hydrate()],
});
