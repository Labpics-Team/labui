/** Импорт регистрирует <lab-loader>; этот entrypoint защищён от tree shaking. */
import { LabLoader } from './lab-loader.js';

export * from './lab-loader.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-loader')) {
  customElements.define('lab-loader', LabLoader);
}
