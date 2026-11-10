/** Импорт регистрирует <lab-textarea>; этот entrypoint защищён от tree shaking. */
import { LabTextarea } from './lab-textarea.js';

export * from './lab-textarea.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-textarea')) {
  customElements.define('lab-textarea', LabTextarea);
}
