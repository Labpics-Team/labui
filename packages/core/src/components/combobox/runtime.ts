import * as combobox from '@zag-js/combobox';
import type { MachineModule, PropTypes, SchemaOf } from '../../behaviors/types.js';
import type { LabComboboxItem } from './lab-combobox.js';

export { filterComboboxItems } from './filter.js';

/** Opening from the editor must preserve its native selection. A deferred
 * refocus otherwise races select-all, pointer placement and composition. */
export const comboboxBehavior: MachineModule<
  SchemaOf<combobox.Service<LabComboboxItem>>,
  combobox.Api<PropTypes, LabComboboxItem>
> = {
  ...combobox,
  machine: {
    ...combobox.machine,
    implementations: {
      ...combobox.machine.implementations,
      actions: {
        ...combobox.machine.implementations?.actions,
        setInitialFocus({ scope }) {
          const input = scope.getById<HTMLInputElement>(
            scope.ids?.input ?? `combobox:${scope.id}:input`,
          );
          if (!input || scope.isActiveElement(input)) return;
          input.focus({ preventScroll: true });
        },
        setFinalFocus({ scope }) {
          const trigger = scope.getById<HTMLElement>(
            scope.ids?.trigger ?? `combobox:${scope.id}:toggle-btn`,
          );
          const target =
            trigger?.dataset.focusable == null
              ? scope.getById<HTMLInputElement>(scope.ids?.input ?? `combobox:${scope.id}:input`)
              : trigger;
          // Both controls are persistent. Restoring now cannot override a user's
          // subsequent Tab/click or a consumer's focus change on the next frame.
          if (target && !scope.isActiveElement(target)) target.focus({ preventScroll: true });
        },
      },
    },
  },
};

/** The dismissable layer is installed on a deferred frame. Escape must also work
 * between opening and that frame, and must not commit/cancel an IME composition. */
export function mountComboboxKeyboard(
  input: HTMLInputElement,
  state: () => {
    open: boolean;
    setOpen(open: boolean, reason?: 'escape-key'): void;
  },
): () => void {
  const window = input.ownerDocument.defaultView;
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !event.composedPath().includes(input) || !state().open) return;
    // Let the platform cancel the composition while preventing the deferred
    // document-level overlay listener from also closing the listbox.
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    state().setOpen(false, 'escape-key');
  };
  window?.addEventListener('keydown', handleEscape, true);
  return () => window?.removeEventListener('keydown', handleEscape, true);
}
