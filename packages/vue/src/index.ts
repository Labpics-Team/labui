/**
 * @labpics/ui-vue — the Vue adapter for LabUI (ADR-0001, A-prime).
 *
 * Vue is NOT a native renderer. Per A-prime, React is the single native
 * implementation; Vue / Svelte / Solid / Astro are delivered AS the Lit Web
 * Components. So the components here are THIN wrappers that mount the shared
 * `<lab-*>` custom elements from @labpics/ui-core and forward props / events /
 * slots — the markup, styles, a11y and behaviour live once in the Lit core and
 * are never re-implemented per stack.
 */

// PRODUCTION Button — a thin Vue wrapper over the Lit `<lab-button>`.
export { Button, type ButtonProps, type ButtonSlots } from './button.js';
