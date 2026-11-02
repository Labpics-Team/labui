/** Импорт регистрирует <lab-accordion>; этот entrypoint защищён от tree shaking. */
import { LabAccordion } from './lab-accordion.js';

export * from './lab-accordion.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-accordion')) {
  customElements.define('lab-accordion', LabAccordion);
}
