import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ship `material.css` alongside the compiled TS. tsup builds the domain module;
 * the CSS is a hand-authored artifact copied verbatim into `dist` so the
 * package export `@labpics/ui-materials/material.css` resolves.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

mkdirSync(dist, { recursive: true });
copyFileSync(resolve(root, 'src', 'material.css'), resolve(dist, 'material.css'));
