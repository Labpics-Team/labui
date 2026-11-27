import { installWindowOnGlobal } from '@lit-labs/ssr/lib/dom-shim.js';

// Synchronous: element modules imported after an SSR entry must see the registry.
// Preserve a registry already installed by the other ESM/CJS entry.
installWindowOnGlobal(typeof customElements === 'undefined' ? {} : { customElements });
