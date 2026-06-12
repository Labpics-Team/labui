/**
 * Measure the real shipped weight of the compiled React Button.
 *
 * Bundles output/react/src/button.tsx with esbuild (production, minified,
 * react/react-dom marked external — they are peer deps, not part of the
 * component's own weight), then reports raw + gzip bytes. This tests the
 * "Mitosis has 0 runtime" claim with a number, not a slogan.
 */
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const ENTRY = 'output/react/src/button.tsx';

const result = await build({
  entryPoints: [ENTRY],
  bundle: true,
  minify: true,
  format: 'esm',
  jsx: 'automatic',
  write: false,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  legalComments: 'none',
});

const out = result.outputFiles[0];
if (!out) throw new Error('esbuild produced no output');

const raw = out.contents.byteLength;
const gz = gzipSync(Buffer.from(out.contents)).byteLength;

// Detect any runtime dependency that leaked into the bundle (valtio/mobx/etc).
const code = out.text;
const runtimeDeps = ['valtio', 'mobx', 'react-solid-state', '@builder.io/mitosis'].filter((dep) =>
  code.includes(dep),
);

process.stdout.write('LabUI Button (Mitosis → React), component-only weight:\n');
process.stdout.write(`  raw:  ${raw} bytes (${(raw / 1024).toFixed(2)} KB)\n`);
process.stdout.write(`  gzip: ${gz} bytes (${(gz / 1024).toFixed(2)} KB)\n`);
process.stdout.write(
  `  runtime deps bundled (excl. react peer): ${runtimeDeps.length ? runtimeDeps.join(', ') : 'NONE — confirmed zero-runtime'}\n`,
);
