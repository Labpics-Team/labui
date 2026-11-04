/** Импорт регистрирует <lab-slider>; этот entrypoint защищён от tree shaking. */
import { LabSlider } from './lab-slider.js';

export * from './lab-slider.js';

if (typeof customElements !== 'undefined' && !customElements.get('lab-slider')) {
  customElements.define('lab-slider', LabSlider);
}
