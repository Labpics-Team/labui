/** Импорт регистрирует <lab-button>; этот entrypoint защищён от tree shaking. */
import { LabButton } from './lab-button.js';

export * from './lab-button.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-button')) {
  customElements.define('lab-button', LabButton);
}
