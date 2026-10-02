// biome-ignore-all lint/suspicious/noConsole: perf minify script - console output IS the result (baseline numbers)
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');

const contractPath = path.join(__dirname, '..', 'packages', 'colors', 'contract.css');
const minPath = path.join(__dirname, '..', 'packages', 'colors', 'contract.min.css');

const css = fs.readFileSync(contractPath, 'utf8');

// Единственный писатель contract.min.css. Минификация консервативная — только
// срез комментариев: селекторы и значения не трогаем, чтобы не менять семантику
// контракта (основной выигрыш к gz даёт именно срез прозы). Прежняя
// «амбициозная» ветка была мертва: её regex /:root\s*\{/ не матчился на
// селекторный список ':root,\n[data-theme="light"]' в contract.css.
const min = css.replace(/\/\*[\s\S]*?\*\//g, '').trim();

fs.writeFileSync(minPath, `${min}\n`);

const origSize = Buffer.byteLength(css) / 1024;
const minSize = Buffer.byteLength(min) / 1024;
const gzOrig = zlib.gzipSync(css).length / 1024;
const gzMin = zlib.gzipSync(min).length / 1024;

console.log('Original:', origSize.toFixed(1), 'KB raw,', gzOrig.toFixed(1), 'KB gz');
console.log('Minified:', minSize.toFixed(1), 'KB raw,', gzMin.toFixed(1), 'KB gz');
console.log('Reduction raw:', `${(((origSize - minSize) / origSize) * 100).toFixed(1)}%`);
console.log('Reduction gz:', `${(((gzOrig - gzMin) / gzOrig) * 100).toFixed(1)}%`);
console.log('Min file written:', minPath);
