/** Импорт регистрирует <lab-popover>; этот entrypoint защищён от tree shaking. */
import { LabPopover } from './lab-popover.js';

export * from './lab-popover.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-popover')) {
  customElements.define('lab-popover', LabPopover);
}
