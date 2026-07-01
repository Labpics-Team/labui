/**
 * @labpics/ui-vue — the native Vue renderer (ADR-0001, A-prime).
 *
 * Thin Vue components over the shared axis types. No Lit runtime in this
 * path; the heavy, shared weight (the axis type contract) lives in
 * @labpics/ui-core and is consumed here type-only, so the Vue API cannot
 * drift from the Lit / React ones.
 */

// PRODUCTION Button — the native-Vue twin of the Lit `<lab-button>`.
export { Button, type ButtonProps, type ButtonSlots } from './button.js';
