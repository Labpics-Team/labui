// Criterion 1 evidence for Astro: build is static, so we read the generated
// HTML directly from dist/ and assert the Button rendered to declarative shadow
// DOM at build time (no client JS needed for first paint → no FOUC).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, 'dist/index.html'), 'utf8');

const hasTag = html.includes('<lab-button');
const hasDeclarativeShadow = /shadowrootmode=/.test(html);
const hasInnerButton = /<template[^>]*shadowrootmode[\s\S]*?<button/.test(html);

process.stdout.write('--- Astro SSR probe ---\n');
process.stdout.write(`  <lab-button> in built HTML:        ${hasTag}\n`);
process.stdout.write(`  declarative shadow DOM present:    ${hasDeclarativeShadow}\n`);
process.stdout.write(`  inner <button> inside the shadow:  ${hasInnerButton}\n`);

const pass = hasTag && hasDeclarativeShadow && hasInnerButton;
process.stdout.write(`  RESULT: ${pass ? 'PASS (build-time SSR, no FOUC)' : 'FAIL'}\n`);
process.exitCode = pass ? 0 : 1;
