/** Импорт регистрирует <lab-pin-input>; этот entrypoint защищён от tree shaking. */
import { LabPinInput } from './lab-pin-input.js';

export * from './lab-pin-input.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-pin-input')) {
  customElements.define('lab-pin-input', LabPinInput);
}
