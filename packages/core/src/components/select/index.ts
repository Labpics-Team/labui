/** Импорт регистрирует <lab-select>; этот entrypoint защищён от tree shaking. */
import { LabSelect } from './lab-select.js';

export * from './lab-select.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-select')) {
  customElements.define('lab-select', LabSelect);
}
