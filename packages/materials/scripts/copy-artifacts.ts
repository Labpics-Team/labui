import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { readMaterialCss } from './material-css';

// CSS-файл и строка для Shadow DOM/SSR получают один результат преобразования.
// minifySyntax выключен: упаковка не меняет синтаксис под новые браузеры.
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

mkdirSync(dist, { recursive: true });
const materialCss = transformSync(readMaterialCss(), {
  loader: 'css',
  minifyWhitespace: true,
  legalComments: 'none',
}).code;
const literal = JSON.stringify(materialCss);
writeFileSync(resolve(dist, 'material.css'), materialCss);
writeFileSync(resolve(dist, 'css.js'), `export const materialCss = ${literal};\n`);
writeFileSync(resolve(dist, 'css.cjs'), `exports.materialCss = ${literal};\n`);
const declaration = 'export declare const materialCss: string;\n';
writeFileSync(resolve(dist, 'css.d.ts'), declaration);
writeFileSync(resolve(dist, 'css.d.cts'), declaration);
