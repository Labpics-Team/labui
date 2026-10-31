import { resolve } from 'node:path';
import { type Plugin, defineConfig } from 'vite';

// Documentation pages and browser evidence share one Vite build, but their
// topology is explicit: user-facing docs live at the root; isolated browser
// oracles live under src/_fixtures and are reachable only by tests. A fixture
// may prove rendering, SSR, material or shadow behavior without becoming a
// documentation surface or a second product API.

/**
 * Inject the server-rendered `<lab-proof>` declarative-shadow-DOM string into
 * `_fixtures/proof.html` at build time, via the real `@labpics/ui-core/ssr` shim. This is
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

// Тот же SSR owner, но отдельный fixture: имя должно существовать до hydration.
function ssrButtonNamesPlugin(): Plugin {
  const placeholder = '<!-- @@SSR_BUTTON_NAMES@@ -->';
  return {
    name: 'labui-ssr-button-names',
    async transformIndexHtml(markup, ctx) {
      if (!ctx.path.endsWith('button-names.html') || !markup.includes(placeholder)) return markup;
      const { renderToString, html } = await import('@labpics/ui-core/ssr');
      await import('@labpics/ui-core/button');
      return markup.replace(
        placeholder,
        renderToString(html`
          <lab-button data-testid="ssr-explicit-default" icon aria-label="Add item"><span>Add</span></lab-button>
          <lab-button data-testid="ssr-default" icon><span>Add</span></lab-button>
          <lab-button data-testid="ssr-explicit" icon aria-label="Add item"></lab-button>
          <lab-button data-testid="ssr-loading" icon loading aria-label="Add item"><span>Add</span></lab-button>
          <lab-button data-testid="ssr-visible" aria-label="Add item"><span>Add</span></lab-button>
        `),
      );
    },
  };
}

export default defineConfig({
  root: 'src',
  plugins: [ssrProofPlugin(), ssrButtonNamesPlugin()],
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
        // Test-only browser oracles. Keeping them below _fixtures prevents a
        // measurement harness from masquerading as documentation.
        'fixture-materials-flag': resolve(__dirname, 'src/_fixtures/materials-flag.html'),
        'fixture-acrylic-live': resolve(__dirname, 'src/_fixtures/acrylic-live.html'),
        'fixture-shadow': resolve(__dirname, 'src/_fixtures/shadow.html'),
        'fixture-proof': resolve(__dirname, 'src/_fixtures/proof.html'),
        'fixture-button-names': resolve(__dirname, 'src/_fixtures/button-names.html'),
        'fixture-tokens': resolve(__dirname, 'src/_fixtures/tokens.html'),
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
        // Text fields: Lit element + native-React twin side by side. PRESENTATIONAL
        // (no machine — the native control owns value/caret/editing), but they OWN
        // the form-field a11y wiring (label / helper / error association) via the
        // SAME shared field-a11y helper — asserted on BOTH renderers in the suite.
        input: resolve(__dirname, 'src/input.html'),
        textarea: resolve(__dirname, 'src/textarea.html'),
        // Numeric form controls: Lit element + native-React twin side by side, running
        // the SAME Zag machine (number-input / slider). The machine owns the value +
        // clamping + the spinbutton / slider role + value ARIA + keyboard stepping; both
        // REUSE the SAME shared field-a11y helper for the label/helper/error association
        // — asserted on BOTH renderers in the suite.
        'number-input': resolve(__dirname, 'src/number-input.html'),
        slider: resolve(__dirname, 'src/slider.html'),
        // Positioned-overlay parity fixtures: Lit element (shadow + strategy:fixed)
        // and native-React twin (body portal), running the SAME Zag machine, for the
        // open/close/positioning/dismiss/keyboard + parity suite.
        tooltip: resolve(__dirname, 'src/tooltip.html'),
        popover: resolve(__dirname, 'src/popover.html'),
        // Modal-overlay parity fixtures: Lit element (body portal + relocated slotted
        // body for a real trap) and native-React twin (createPortal body), running the
        // SAME @zag-js/dialog machine, for the open/dismiss/trap/scroll-lock + parity
        // suite. Alert-dialog adds the role="alertdialog" no-outside-dismiss contract.
        dialog: resolve(__dirname, 'src/dialog.html'),
        'alert-dialog': resolve(__dirname, 'src/alert-dialog.html'),
        // Navigation batch: Tabs (compound, @zag-js/tabs), Breadcrumb
        // (presentational), Pagination (@zag-js/pagination) — each mounts the Lit
        // element and its native-React twin side by side for the parity suite.
        tabs: resolve(__dirname, 'src/tabs.html'),
        breadcrumb: resolve(__dirname, 'src/breadcrumb.html'),
        pagination: resolve(__dirname, 'src/pagination.html'),
        // Compound control: Lit `<lab-radio-group>` (all parts in one shadow
        // scope) + native-React `<RadioGroup>`/`<Radio>` side by side, running the
        // SAME Zag group machine, for the parity + behaviour suite.
        'radio-group': resolve(__dirname, 'src/radio-group.html'),
        // Disclosure batch: Accordion (compound, @zag-js/accordion), Card
        // (presentational opt-out), Progress (@zag-js/progress) — each mounts the
        // Lit element and its native-React twin side by side for the parity suite.
        accordion: resolve(__dirname, 'src/accordion.html'),
        card: resolve(__dirname, 'src/card.html'),
        progress: resolve(__dirname, 'src/progress.html'),
        // Compound + positioned controls: Lit `<lab-select>` / `<lab-menu>` (all
        // parts in one shadow scope, listbox/menu positioned with strategy:fixed) +
        // native-React `<Select>` / `<Menu>` (body portal) side by side, running the
        // SAME Zag machine, for the open/navigate/select/dismiss/position + parity
        // suite. The canon fusing the keyed-compound group machine with the overlay.
        select: resolve(__dirname, 'src/select.html'),
        menu: resolve(__dirname, 'src/menu.html'),
        // Combobox: Lit `<lab-combobox>` (all parts in one shadow scope, listbox
        // positioned with strategy:fixed) + native-React `<Combobox>` (body portal),
        // side by side, running the SAME @zag-js/combobox machine — a Select listbox
        // FUSED with a filterable text input + the shared field-a11y wiring. For the
        // open/filter/navigate/select/dismiss/position + parity + value-change suite.
        combobox: resolve(__dirname, 'src/combobox.html'),
        // Advanced form inputs: Lit element + native-React twin side by side, running the
        // SAME Zag machine (pin-input / tags-input). Pin Input's machine owns each box's
        // value + focus auto-advance + paste-fill + masking; Tags Input's owns the tag
        // array + add/remove/edit/keyboard. Both REUSE the SAME shared field-a11y helper
        // for the label/helper/error association — asserted on BOTH renderers in the suite.
        'pin-input': resolve(__dirname, 'src/pin-input.html'),
        'tags-input': resolve(__dirname, 'src/tags-input.html'),
      },
    },
  },
});
