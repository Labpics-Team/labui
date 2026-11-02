/** Импорт регистрирует <lab-pagination>; этот entrypoint защищён от tree shaking. */
import { LabPagination } from './lab-pagination.js';

export * from './lab-pagination.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-pagination')) {
  customElements.define('lab-pagination', LabPagination);
}
