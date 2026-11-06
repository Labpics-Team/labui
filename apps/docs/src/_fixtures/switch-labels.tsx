import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-core/switch';
import '@labpics/ui-tokens/motion.css';
import { hydrateRoot } from 'react-dom/client';
import { ReactSwitchLabels } from './switch-labels-react';

class SwitchLabelProjection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML =
      '<lab-switch type="neutral" aria-label="Wi-Fi"><slot name="caption"></slot></lab-switch>';
  }
}

class ClosedSwitchCaption extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'closed' }).innerHTML = '<span>Closed label</span>';
  }
}

class OpenSwitchCaption extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<span>Open label</span>';
  }
}

customElements.define('switch-label-projection', SwitchLabelProjection);
customElements.define('closed-switch-caption', ClosedSwitchCaption);
customElements.define('open-switch-caption', OpenSwitchCaption);

const root = document.querySelector('#react-labels');
if (!root) throw new Error('Нет React Switch labels root');
hydrateRoot(root, <ReactSwitchLabels />);
