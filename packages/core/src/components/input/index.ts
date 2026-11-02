/** Импорт регистрирует <lab-input>; этот entrypoint защищён от tree shaking. */
import { LabInput } from './lab-input.js';

export * from './lab-input.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-input')) {
  customElements.define('lab-input', LabInput);
}
