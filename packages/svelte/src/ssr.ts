/**
 * Whole-host HTML helpers for static server fragments.
 * Ordinary components from @labpics/ui-svelte use native framework SSR/hydration.
 * These helpers accept strings, so their slots have no framework handlers or state.
 * See docs/reference/framework-ssr.md for the component lifecycle contract.
 */
export * from './generated/ssr.js';
