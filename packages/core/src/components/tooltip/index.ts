/** Импорт регистрирует <lab-tooltip>; этот entrypoint защищён от tree shaking. */
import { LabTooltip } from './lab-tooltip.js';

export * from './lab-tooltip.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-tooltip')) {
  customElements.define('lab-tooltip', LabTooltip);
}
