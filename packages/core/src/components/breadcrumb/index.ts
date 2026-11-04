/** Импорт регистрирует <lab-breadcrumb>; этот entrypoint защищён от tree shaking. */
import { LabBreadcrumb } from './lab-breadcrumb.js';

export * from './lab-breadcrumb.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-breadcrumb')) {
  customElements.define('lab-breadcrumb', LabBreadcrumb);
}
