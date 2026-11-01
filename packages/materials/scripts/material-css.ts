import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIAL_CSS_ORDER } from '../src/materials/order';

/*
 * ЕДИНСТВЕННАЯ сборка material.css из файлов-материалов: конкатенация по
 * закону порядка (src/materials/order.ts). Её используют билд (copy-artifacts)
 * и все CSS-читающие тесты — вторых копий логики склейки нет, дрейф невозможен.
 */

export function materialsDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'materials');
}

/** Исходный CSS в каноническом порядке, до упаковочного удаления пробелов. */
export function readMaterialCss(): string {
  const dir = materialsDir();
  return MATERIAL_CSS_ORDER.map((file) => readFileSync(resolve(dir, file), 'utf8')).join('\n');
}
