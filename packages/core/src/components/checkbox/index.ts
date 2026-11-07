/** Импорт регистрирует <lab-checkbox>; этот entrypoint защищён от tree shaking. */
import { LabCheckbox } from './lab-checkbox.js';

export * from './lab-checkbox.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-checkbox')) {
  customElements.define('lab-checkbox', LabCheckbox);
}
