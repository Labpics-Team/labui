/**
 * `lab-card` public entry — the single-wildcard resolution seam.
 *
 * Re-exports the element module and runs its self-registration side effect, so
 * importing this barrel upgrades `<lab-card>`. Adding a component stays purely
 * additive: drop the element file plus this one-line barrel, touch no shared file.
 */
export * from './lab-card.js';
