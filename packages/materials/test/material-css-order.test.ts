import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { materialsDir, readMaterialCss } from '../scripts/material-css';
import { MATERIAL_CSS_ORDER } from '../src/materials/order';

/*
 * Закон порядка файлов-материалов (ADR-0009). Разрез material.css на файлы —
 * находимость, а не смена каскада: solid-оверрайд обязан стоять ПОСЛЕ мод,
 * engine-held — после мод, деградации — после всего материального, veil —
 * последним. Равная специфичность решается источником, поэтому перестановка
 * строк в order.ts МЕНЯЕТ рендер — этот замок делает перестановку громкой.
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
      '[data-material="glass"] .lab-material', // мода glass
      '[data-material="acrylic"] .lab-material', // мода acrylic
      '.lab-material--lensed', // engine-held: после мод, до solid
      '[data-material="solid"] .lab-material', // solid-оверрайд бьёт моды
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
      'degradations.css',
      'veil.css',
    ]);
  });
});
