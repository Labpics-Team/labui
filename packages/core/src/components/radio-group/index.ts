/** Импорт регистрирует <lab-radio-group>; этот entrypoint защищён от tree shaking. */
import { LabRadioGroup } from './lab-radio-group.js';

export * from './lab-radio-group.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-radio-group')) {
  customElements.define('lab-radio-group', LabRadioGroup);
}
