/** Импорт регистрирует <lab-switch>; этот entrypoint защищён от tree shaking. */
import { LabSwitch } from './lab-switch.js';

export * from './lab-switch.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-switch')) {
  customElements.define('lab-switch', LabSwitch);
}
