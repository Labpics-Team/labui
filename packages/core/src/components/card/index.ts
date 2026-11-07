/** Импорт регистрирует <lab-card>; этот entrypoint защищён от tree shaking. */
import { LabCard } from './lab-card.js';

export * from './lab-card.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-card')) {
  customElements.define('lab-card', LabCard);
}
