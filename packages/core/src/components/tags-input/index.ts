/** Импорт регистрирует <lab-tags-input>; этот entrypoint защищён от tree shaking. */
import { LabTagsInput } from './lab-tags-input.js';

export * from './lab-tags-input.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-tags-input')) {
  customElements.define('lab-tags-input', LabTagsInput);
}
