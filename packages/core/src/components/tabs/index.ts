/** Импорт регистрирует <lab-tabs>; этот entrypoint защищён от tree shaking. */
import { LabTabs } from './lab-tabs.js';

export * from './lab-tabs.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-tabs')) {
  customElements.define('lab-tabs', LabTabs);
}
