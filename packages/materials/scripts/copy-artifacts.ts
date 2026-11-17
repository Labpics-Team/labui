import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materialProfile } from '../src/profile';
import { acrylicNoisePng } from './build-acrylic-noise';
import { readMaterialCss } from './material-css';

/*
 * Ship `material.css` alongside the compiled TS. Публичный экспорт пакета —
 * по-прежнему ОДИН файл `@labpics/ui-materials/material.css`; исходники
 * разложены по материалам (src/materials/*.css, ADR-0009) и склеиваются здесь
 * по закону порядка — той же функцией, которой CSS читают тесты.
 */
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

mkdirSync(dist, { recursive: true });
copyFileSync(resolve(here, '../src/profile.json'), resolve(dist, 'profile.json'));
const css = readMaterialCss();
writeFileSync(resolve(dist, 'material.css'), css);
// Shadow-root consumers receive the exact stylesheet, without a hand-kept copy.
writeFileSync(resolve(dist, 'css.js'), `export const materialCss = ${JSON.stringify(css)};\n`);
writeFileSync(resolve(dist, 'css.cjs'), `exports.materialCss = ${JSON.stringify(css)};\n`);
writeFileSync(resolve(dist, 'css.d.ts'), 'export declare const materialCss: string;\n');
writeFileSync(resolve(dist, 'css.d.cts'), 'export declare const materialCss: string;\n');
writeFileSync(resolve(dist, 'noise.png'), acrylicNoisePng());
writeFileSync(
  resolve(dist, 'veil-noise.png'),
  acrylicNoisePng(materialProfile.progressive.styles.strong.noiseOpacity),
);
