/**
 * `lab-alert-dialog` public entry — the single-wildcard resolution seam.
 *
 * Re-exports the element module and runs its self-registration side effect, so
 * importing this barrel upgrades `<lab-alert-dialog>`. Its existence lets ONE wildcard
 * (`@labpics/ui-core/<name>` resolving to this barrel) reach every component with a
 * single substitution — the only form TypeScript and esbuild both accept. Adding a
 * component stays purely additive: drop the element file plus this one-line barrel,
 * touch no shared file.
 *
 * Registration runs HERE (not at the element module's top level) because this element
 * shares the `LabDialog` base in a hoisted chunk OUTSIDE `dist/components/**`; the
 * barrel is sideEffects-protected, so the `registerLabAlertDialog()` call here survives
 * tree-shaking and the element upgrades on import.
 */
export * from './lab-alert-dialog.js';
import { registerLabAlertDialog } from './lab-alert-dialog.js';

registerLabAlertDialog();
