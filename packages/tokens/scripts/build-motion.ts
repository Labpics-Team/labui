/**
 * Build-time entry for the MOTION tier: resolve the default motion config,
 * generate the three artifacts, and write them to `src/generated/`. Parallel to
 * `build-tokens.ts` (the dimension tier) and deliberately separate so the
 * dimension contract's regeneration is untouched.
 *
 * Generated artifacts are committed (not gitignored) so consumers can `@import`
 * the CSS without running the generator, and the DTCG export is reviewable.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultMotionConfig } from '../src/motion/config.js';
import { generateMotion } from '../src/motion/generate/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'generated');

function main(): void {
  const artifacts = generateMotion(defaultMotionConfig);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, 'motion.css'), artifacts.css, 'utf8');
  writeFileSync(join(outDir, 'motion.dtcg.json'), artifacts.dtcg, 'utf8');
  writeFileSync(join(outDir, 'motion.ts'), artifacts.ts, 'utf8');

  process.stdout.write(`motion: wrote 3 artifacts to ${outDir}\n`);
}

main();
