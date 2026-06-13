/**
 * `lab-checkbox` public entry — the single-wildcard resolution seam.
 *
 * Re-exports the element module and runs its self-registration side effect, so
 * importing this barrel upgrades `<lab-checkbox>`. Its existence lets ONE wildcard
 * (`@labpics/ui-core/<name>` resolving to this barrel) reach every component
 * with a single substitution — the only form TypeScript and esbuild both
 * accept. Adding a component stays purely additive: drop the element file plus
 * this one-line barrel, touch no shared file.
 */
export * from './lab-checkbox.js';
