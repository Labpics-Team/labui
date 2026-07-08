const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const contractPath = path.join(__dirname, '..', 'packages', 'colors-stub', 'contract.css');
const minPath = path.join(__dirname, '..', 'packages', 'colors-stub', 'contract.min.css');

let css = fs.readFileSync(contractPath, 'utf8');

// Simple CSS minify for var declarations: remove comments, collapse whitespace around : ; { }
let min = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*([:;{}])\s*/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

fs.writeFileSync(minPath, min + '\n');

const origSize = Buffer.byteLength(css) / 1024;
const minSize = Buffer.byteLength(min) / 1024;
const gzOrig = zlib.gzipSync(css).length / 1024;
const gzMin = zlib.gzipSync(min).length / 1024;

console.log('Original:', origSize.toFixed(1), 'KB raw,', gzOrig.toFixed(1), 'KB gz');
console.log('Minified:', minSize.toFixed(1), 'KB raw,', gzMin.toFixed(1), 'KB gz');
console.log('Reduction raw:', ((origSize - minSize) / origSize * 100).toFixed(1) + '%');
console.log('Reduction gz:', ((gzOrig - gzMin) / gzOrig * 100).toFixed(1) + '%');
console.log('Min file written:', minPath);
