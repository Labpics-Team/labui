import lit from '@astrojs/lit';
import { defineConfig } from 'astro/config';

// @astrojs/lit SSRs Lit elements to declarative shadow DOM at build time. This
// is the Astro half of criterion 1 — no manual DOM shim wiring beyond adding
// the integration.
export default defineConfig({
  integrations: [lit()],
});
