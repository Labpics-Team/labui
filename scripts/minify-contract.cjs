// biome-ignore-all lint/suspicious/noConsole: perf minify script - console output IS the result (baseline numbers)
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');

const contractPath = path.join(__dirname, '..', 'packages', 'colors-stub', 'contract.css');
const minPath = path.join(__dirname, '..', 'packages', 'colors-stub', 'contract.min.css');

const css = fs.readFileSync(contractPath, 'utf8');

// Ambitious CSS minify (synced to generate-contract minifyContract for build/perf consistency).
// Strips comments + aggressive safe ws collapse (incl. / alpha, (), ,, ; before }).
// Keeps full contract.css for tests/gates (byte-identical discipline).
// Produces smaller contract.min.css for published consumers (perf:size target).
const min = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(\s*--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g, '$1:$2;')
  .replace(/\s*([{}:;])\s*/g, '$1')
  .replace(/\s+/g, ' ')
  .replace(/\s*\/\s*/g, '/')
  .replace(/(\w)\s+\(/g, '$1(')
  .replace(/\(\s+/g, '(')
  .replace(/\s+\)/g, ')')
  .replace(/,\s*/g, ',')
  .replace(/;(?=})/g, '')
  .trim();

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
