/** Импорт регистрирует <lab-menu>; этот entrypoint защищён от tree shaking. */
import { LabMenu } from './lab-menu.js';

export * from './lab-menu.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-menu')) {
  customElements.define('lab-menu', LabMenu);
}
