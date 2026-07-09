import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
writeFileSync(resolve(dist, 'material.css'), readMaterialCss());
