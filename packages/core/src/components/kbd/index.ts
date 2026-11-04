/** Импорт регистрирует <lab-kbd>; этот entrypoint защищён от tree shaking. */
import { LabKbd } from './lab-kbd.js';

export * from './lab-kbd.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-kbd')) {
  customElements.define('lab-kbd', LabKbd);
}
