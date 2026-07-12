// Размерный отчёт: console.info — и есть результат скрипта.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const TARGETS = [
  'packages/colors-stub/contract.css',
  'packages/colors-stub/contract.min.css',
  'packages/shadow/dist/shadow.css',
  'packages/core/dist/index.js',
  'packages/react/dist/index.js',
  'packages/materials/dist/material.css',
];

const kb = (n) => (n / 1024).toFixed(1);

console.info('=== Perf size baseline (published artifacts) ===');
const sizes = new Map();
for (const path of TARGETS) {
  let buf;
  try {
    buf = readFileSync(path);
  } catch {
    continue; // dist-артефакт ещё не собран — пропускаем строку
  }
  sizes.set(path, { raw: buf.length, gz: gzipSync(buf).length });
  const { raw, gz } = sizes.get(path);
  console.info(`${path}: raw ${kb(raw)}KB gz ${kb(gz)}KB`);
}

const full = sizes.get('packages/colors-stub/contract.css');
const min = sizes.get('packages/colors-stub/contract.min.css');
if (full && min) {
  const dr = (((full.raw - min.raw) / full.raw) * 100).toFixed(1);
  const dg = (((full.gz - min.gz) / full.gz) * 100).toFixed(1);
  console.info(`contract min win: raw -${dr}%, gz -${dg}%`);
}
