// Svelte 5 WC-SSR probe. Same shape as the Vue probe.
import { render } from './dist/entry-server.mjs';

const html = render();

const nativeSection = html.match(/data-path="native"[\s\S]*?<\/section>/)?.[0] ?? '';
const litSection = html.match(/data-path="lit-ssr"[\s\S]*?<\/section>/)?.[0] ?? '';

const nativeHasTag = /<lab-button/.test(nativeSection);
const nativeHasDsd = /shadowrootmode/.test(nativeSection);
const litHasDsd = /shadowrootmode/.test(litSection);
const litHasInnerButton = /<template[^>]*shadowrootmode[\s\S]*?<button/.test(litSection);

process.stdout.write('--- Svelte 5 WC-SSR probe ---\n');
process.stdout.write(`  native path: <lab-button> emitted:        ${nativeHasTag}\n`);
process.stdout.write(
  `  native path: declarative shadow DOM:       ${nativeHasDsd}  (expected false — shallow, like Next)\n`,
);
process.stdout.write(`  lit-ssr path: declarative shadow DOM:      ${litHasDsd}\n`);
process.stdout.write(`  lit-ssr path: inner <button> in shadow:    ${litHasInnerButton}\n`);

const pass = litHasDsd && litHasInnerButton;
process.stdout.write(
  `  RESULT: ${pass ? 'PASS (Svelte SSR carries Lit DSD intact → first paint, no FOUC)' : 'FAIL'}\n`,
);
process.exitCode = pass ? 0 : 1;
