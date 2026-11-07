/** Импорт регистрирует <lab-combobox>; этот entrypoint защищён от tree shaking. */
import { LabCombobox } from './lab-combobox.js';

export * from './lab-combobox.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-combobox')) {
  customElements.define('lab-combobox', LabCombobox);
}
