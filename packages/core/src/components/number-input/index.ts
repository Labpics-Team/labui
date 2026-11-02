/** Импорт регистрирует <lab-number-input>; этот entrypoint защищён от tree shaking. */
import { LabNumberInput } from './lab-number-input.js';

export * from './lab-number-input.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-number-input')) {
  customElements.define('lab-number-input', LabNumberInput);
}
