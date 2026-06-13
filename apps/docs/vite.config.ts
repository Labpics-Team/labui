import { resolve } from 'node:path';
import { type Plugin, defineConfig } from 'vite';

// The docs site is a static page for now. The framework (Astro Starlight is the
// reversible default) is decided in the docs research task; Vite serves the
// smoke fixture today without coupling the harness to that choice.
//
// Multi-page: each demo fixture is its own .html entry so every material
// surface is verified in isolation without touching the token fixtures.
// `materials.html` is the Ambient/Solid material demo (mode + theme switchers,
// product card + sign-in form + the Ambient blur ladder) — it replaces the old
// `glass.html` per the owner's verdict (web glass is native-only). `shadow.html`
// is the shadow-stack demo. `proof.html` is the core-scaffold proof:
// `<lab-proof>` client-rendered AND server-rendered (declarative shadow DOM).

/**
 * Inject the server-rendered `<lab-proof>` declarative-shadow-DOM string into
 * `proof.html` at build time, via the real `@labpics/ui-core/ssr` shim. This is
 * the page's SSR proof: the delivered HTML carries styled shadow content with no
 * FOUC, before any client JS runs. The placeholder `<!-- @@SSR_PROOF@@ -->` is
 * replaced; other pages are untouched.
 */
function ssrProofPlugin(): Plugin {
  const PLACEHOLDER = '<!-- @@SSR_PROOF@@ -->';
  return {
    name: 'labui-ssr-proof',
    async transformIndexHtml(html, ctx) {
      if (!ctx.path.endsWith('proof.html') || !html.includes(PLACEHOLDER)) return html;
      // Import order is load-bearing: the SSR shim installs the DOM shim, then the
      // proof element registers against it.
      const { renderToString, html: litHtml } = await import('@labpics/ui-core/ssr');
      await import('@labpics/ui-core/proof');
      const dsd = renderToString(
        litHtml`<lab-proof data-testid="proof-ssr" default-pressed>SSR proof</lab-proof>`,
      );
      return html.replace(PLACEHOLDER, dsd);
    },
  };
}

export default defineConfig({
  root: 'src',
  plugins: [ssrProofPlugin()],
  // The Button parity page mounts a native-React island (button-demo.tsx). Vite's
  // built-in esbuild handles the automatic JSX transform — no plugin-react /
  // Fast-Refresh needed for these static build+preview fixtures.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        materials: resolve(__dirname, 'src/materials.html'),
        shadow: resolve(__dirname, 'src/shadow.html'),
        proof: resolve(__dirname, 'src/proof.html'),
        // The reusable component-doc template (rendered from a ComponentDoc
        // config; ?component=<slug> selects which one).
        components: resolve(__dirname, 'src/components.html'),
        // Button parity fixture: Lit `<lab-button>` and native-React `<Button>`
        // side by side under one [data-theme], for the parity + behaviour suite.
        button: resolve(__dirname, 'src/button.html'),
        // Presentational-primitive parity fixtures — each mounts the Lit element
        // and its native-React twin side by side under one [data-theme].
        badge: resolve(__dirname, 'src/badge.html'),
        kbd: resolve(__dirname, 'src/kbd.html'),
        loader: resolve(__dirname, 'src/loader.html'),
        avatar: resolve(__dirname, 'src/avatar.html'),
        // Machine-driven form controls: Lit element + native-React twin side by
        // side, running the SAME Zag machine, for the parity + behaviour suite.
        switch: resolve(__dirname, 'src/switch.html'),
        checkbox: resolve(__dirname, 'src/checkbox.html'),
      },
    },
  },
});
