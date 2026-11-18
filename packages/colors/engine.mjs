import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initializeColors } from './program.mjs';

const require = createRequire(import.meta.url);

/** Node entry: the browser passes the emitted WASM URL instead of file bytes. */
export async function initializeNodeColors() {
  await initializeColors({
    module_or_path: await readFile(require.resolve('@labpics/colors/pkg/labcolors_bg.wasm')),
  });
}
