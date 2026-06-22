/*
 * Core-scaffold PROOF demo.
 *
 * Registers `<lab-proof>` (the proof element, NOT the production Button) on the
 * client and wires the theme switcher. The proof's whole job is to exercise the
 * scaffold seam in a real browser: the Zag toggle machine drives the element,
 * tokens style it, and `[data-theme]` on the root re-skins it with zero edits.
 *
 * The page also carries a SERVER-rendered `<lab-proof>` island (injected at
 * build time via the SSR shim — see vite.config.ts) so the smoke can assert real
 * declarative shadow DOM in the delivered HTML, before any JS runs.
 */
import '@labpics/ui-core/proof';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
