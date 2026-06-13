/**
 * `lab-breadcrumb` public entry — the single-wildcard resolution seam.
 *
 * Re-exports the element module and runs its self-registration side effect, so
 * importing this barrel upgrades `<lab-breadcrumb>`. One wildcard
 * (`@labpics/ui-core/<name>`) reaches it; adding the component stays purely
 * additive — this one-line barrel plus the element file, no shared file touched.
 */
export * from './lab-breadcrumb.js';
