/**
 * `lab-dialog` public entry — the single-wildcard resolution seam.
 *
 * Re-exports the element module and runs its self-registration side effect, so
 * importing this barrel upgrades `<lab-dialog>`. Its existence lets ONE wildcard
 * (`@labpics/ui-core/<name>` resolving to this barrel) reach every component with a
 * single substitution — the only form TypeScript and esbuild both accept. Adding a
 * component stays purely additive: drop the element file plus this one-line barrel,
 * touch no shared file.
 *
 * Registration runs HERE (not at the element module's top level) because
 * `<lab-alert-dialog>` extends `LabDialog`, so tsup hoists the class into a shared
 * chunk OUTSIDE `dist/components/**`; a bare side-effect there would be tree-shaken by a
 * consumer's bundler. The barrel is sideEffects-protected (`dist/components/**`), so the
 * `registerLabDialog()` call here always survives — the element upgrades on import.
 */
export * from './lab-dialog.js';
import { registerLabDialog } from './lab-dialog.js';

registerLabDialog();
