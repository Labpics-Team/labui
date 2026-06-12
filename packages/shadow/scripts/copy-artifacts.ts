/**
 * Copy the generated CSS from `src/generated/` into `dist/` after tsup builds
 * the JS/types, so the package's `./shadow.css` export resolves for consumers.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const generated = join(here, '..', 'src', 'generated');
const dist = join(here, '..', 'dist');

function main(): void {
  mkdirSync(dist, { recursive: true });
  copyFileSync(join(generated, 'shadow.css'), join(dist, 'shadow.css'));
  process.stdout.write('shadow: copied shadow.css to dist\n');
}

main();
