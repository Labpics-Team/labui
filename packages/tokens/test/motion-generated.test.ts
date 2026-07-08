import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultMotionConfig } from '../src/motion/config.js';
import { generateMotion } from '../src/motion/generate/index.js';

/**
 * Drift lock: the COMMITTED generated artifacts must equal a fresh generation
 * from the config. This catches a config edit that was not regenerated even if
 * the CI `check-generated` gate is not run, and pins the artifact the docs site
 * and consumers actually import.
 */

const here = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(here, '..', 'src', 'generated');

function read(file: string): string {
  return readFileSync(join(generatedDir, file), 'utf8');
}

describe('committed motion artifacts are in sync with the generator', () => {
  const fresh = generateMotion(defaultMotionConfig);

  it('motion.css matches', () => {
    expect(read('motion.css')).toBe(fresh.css);
  });

  it('motion.dtcg.json matches', () => {
    expect(read('motion.dtcg.json')).toBe(fresh.dtcg);
  });

  it('motion.ts matches', () => {
    expect(read('motion.ts')).toBe(fresh.ts);
  });
});
