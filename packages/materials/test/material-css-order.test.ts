import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { materialsDir, readMaterialCss } from '../scripts/material-css';
import { MATERIAL_CSS_ORDER } from '../src/materials/order';

/*
 * Закон порядка файлов-материалов (ADR-0009). Разрез material.css на файлы —
 * находимость, а не смена каскада: рецепты ограничены ближайшей областью,
 * engine-held стоит после рецептов и побеждает стекло при равной специфичности.
 * Деградации имеют более высокую специфичность и идут после материалов,
 * veil — последним. Порядок engine-held влияет на рендер внутри glass.
 */

describe('файлы-материалы: закон порядка склейки', () => {
  const css = readMaterialCss();

  it('каждый файл закона существует, и в папке нет CSS вне закона', () => {
    const onDisk = readdirSync(materialsDir())
      .filter((f) => f.endsWith('.css'))
      .sort();
    expect(onDisk).toEqual([...MATERIAL_CSS_ORDER].sort());
  });

  it('каскадные вехи идут строго в порядке закона', () => {
    const landmarks = [
      '.lab-material {', // base: переменные + единое paint-правило
      '[data-material="glass"] {', // контекст glass
      '[data-material="acrylic"] {', // контекст acrylic
      '.lab-material--lensed', // engine-held: после мод, до solid
      ':where([data-material]) {', // сброс любой явной области
      'DETERMINISTIC DEGRADATIONS', // деградации бьют всё материальное
      'LAB-VEIL', // veil — отдельная эффект-поверхность, последним
    ];
    let prev = -1;
    for (const mark of landmarks) {
      const at = css.indexOf(mark);
      expect(at, `веха «${mark}» присутствует`).toBeGreaterThanOrEqual(0);
      expect(at, `веха «${mark}» стоит после предыдущей`).toBeGreaterThan(prev);
      prev = at;
    }
  });

  it('порядок мод в законе — glass, acrylic, engine-held, solid, degradations, veil', () => {
    expect(MATERIAL_CSS_ORDER).toEqual([
      'base.css',
      'glass.css',
      'acrylic.css',
      'engine-held.css',
      'solid.css',
      'sheet.css',
      'degradations.css',
      'veil.css',
    ]);
  });
});
