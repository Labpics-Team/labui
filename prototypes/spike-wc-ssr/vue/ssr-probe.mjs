// Vue WC-SSR probe. Imports the built SSR bundle, renders to HTML, and reports
// which path carried declarative shadow DOM through Vue's server renderer.
import { render } from './dist/entry-server.mjs';

const html = await render();

// Scope the checks to each <section> so we attribute DSD to the right path.
const nativeSection = html.match(/data-path="native"[\s\S]*?<\/section>/)?.[0] ?? '';
const litSection = html.match(/data-path="lit-ssr"[\s\S]*?<\/section>/)?.[0] ?? '';

const nativeHasTag = /<lab-button/.test(nativeSection);
const nativeHasDsd = /shadowrootmode/.test(nativeSection);
const litHasDsd = /shadowrootmode/.test(litSection);
const litHasInnerButton = /<template[^>]*shadowrootmode[\s\S]*?<button/.test(litSection);

process.stdout.write('--- Vue 3 WC-SSR probe ---\n');
process.stdout.write(`  native path: <lab-button> emitted:        ${nativeHasTag}\n`);
process.stdout.write(
  `  native path: declarative shadow DOM:       ${nativeHasDsd}  (expected false — shallow, like Next)\n`,
);
process.stdout.write(`  lit-ssr path: declarative shadow DOM:      ${litHasDsd}\n`);
process.stdout.write(`  lit-ssr path: inner <button> in shadow:    ${litHasInnerButton}\n`);

// PASS criterion (matrix): HTML contains declarative shadow DOM OR controlled
// hydration without FOUC. The lit-ssr path delivers DSD => first paint with no
// FOUC. Vue passing it through intact is the falsifier check.
const pass = litHasDsd && litHasInnerButton;
process.stdout.write(
  `  RESULT: ${pass ? 'PASS (Vue SSR carries Lit DSD intact → first paint, no FOUC)' : 'FAIL'}\n`,
);
process.exitCode = pass ? 0 : 1;
