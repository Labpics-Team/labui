/** Импорт регистрирует <lab-badge>; этот entrypoint защищён от tree shaking. */
import { LabBadge } from './lab-badge.js';

export * from './lab-badge.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-badge')) {
  customElements.define('lab-badge', LabBadge);
}
