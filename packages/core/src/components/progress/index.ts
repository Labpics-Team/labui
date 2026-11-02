/** Импорт регистрирует <lab-progress>; этот entrypoint защищён от tree shaking. */
import { LabProgress } from './lab-progress.js';

export * from './lab-progress.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-progress')) {
  customElements.define('lab-progress', LabProgress);
}
