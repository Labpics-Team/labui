/** Импорт регистрирует <lab-avatar>; этот entrypoint защищён от tree shaking. */
import { LabAvatar } from './lab-avatar.js';

export * from './lab-avatar.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-avatar')) {
  customElements.define('lab-avatar', LabAvatar);
}
