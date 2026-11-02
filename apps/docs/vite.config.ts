import { resolve } from 'node:path';
import hydrate from '@labpics/ui-core/hydrate';
import { type Plugin, defineConfig, transformWithEsbuild } from 'vite';
import { registerBooleanExtensions } from '../../packages/core/test/fixtures/boolean-extensions';

function booleanExtensionFixture(): Plugin {
  const fixture = resolve(
    __dirname,
    '../../packages/core/test/fixtures/boolean-extensions.ts',
  ).replaceAll('\\', '/');
  return {
    name: 'labui-boolean-extension-fixture',
    enforce: 'pre',
    transform(code, id) {
      if (id.split('?')[0] !== fixture) return;
      // Standard decorators компилируются как в приложении потребителя.
      return transformWithEsbuild(code, id, { loader: 'ts', target: 'es2022' });
    },
  };
}
import { Switch } from '@labpics/ui-react/switch';
import { StrictMode, createElement } from 'react';
import { renderToString as renderReactToString } from 'react-dom/server';
import { renderCardAnatomy } from './src/_fixtures/card-anatomy-ssr';

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
      if (ctx.path.endsWith('card-anatomy.html')) {
        return html.replace('<!-- @@SSR_CARD_ANATOMY@@ -->', await renderCardAnatomy());
      }
      if (ctx.path.endsWith('card-material-shadow.html')) {
        const { renderToString, html: litHtml, ifDefined } = await import('@labpics/ui-core/ssr');
        const { materialCss } = await import('@labpics/ui-materials/css');
        await import('@labpics/ui-core/card');
        const renderCard = (id: string, mode?: string, alternate = false): string => {
          const color = alternate ? 'rgb(140 35 180)' : 'rgb(180 40 30)';
          const tokens = `--lab-bg-material-elevated-01:transparent;--lab-bg-material-elevated-02:rgb(70 70 70);--lab-bg-grouped-secondary:${color};--lab-bg-material-base-01:transparent;--lab-bg-material-base-02:rgb(70 70 70);--lab-bg-primary:rgb(20 20 20);--lab-bg-secondary:rgb(30 30 30);--lab-label-primary:white;--lab-stroke-hairline:1px;--lab-radius-card:16px;--lab-space-md:16px;--lab-bg-static-light:white;--lab-bg-static-dark:black`;
          return renderToString(
            litHtml`<lab-card id=${id} padding="none" data-material=${ifDefined(mode)} style=${tokens}><div style="height:96px"></div></lab-card>`,
          );
        };
        const closed = `<lab-shadow-consumer id="closed-owner"><template shadowrootmode="closed"><style>:host{display:block;width:240px}</style>${renderCard('closed-card', undefined, true)}</template></lab-shadow-consumer>`;
        const slotted = (id: string, mode: 'open' | 'closed'): string =>
          `<div id="${mode === 'open' ? 'open-owner' : 'hidden-owner'}" data-material="solid"><template shadowrootmode="${mode}"><style>${materialCss}</style><div id="slot-scope" data-material="glass"><slot></slot></div></template>${renderCard(id)}</div>`;
        const markup = `<section class="stage" data-card="standalone">${renderCard('standalone')}</section>
          <div id="outer-scope" data-material="glass" style="display:contents">
            <section class="stage" data-card="outer-glass">${renderCard('outer-glass')}</section>
            <section class="stage" data-card="closed-card">${closed}</section>
            <section class="stage" data-card="explicit-solid">${renderCard('explicit-solid', 'solid', true)}</section>
            <section class="stage" data-card="unknown">${renderCard('unknown', 'unknown')}</section>
            <section class="stage" data-card="empty">${renderCard('empty', '')}</section>
          </div>
          <section class="stage" data-card="open-slot">${slotted('open-slot', 'open')}</section>
          <section class="stage" data-card="hidden-slot">${slotted('hidden-slot', 'closed')}</section>`;
        return html.replace('<!-- @@SSR_CARD_MATERIALS@@ -->', markup);
      }
      if (ctx.path.endsWith('switch-motion.html')) {
        const { renderToString, html: litHtml } = await import('@labpics/ui-core/ssr');
        await import('@labpics/ui-core/switch');
        return html
          .replace(
            '<!-- @@SSR_SWITCH_DEFAULT@@ -->',
            renderToString(litHtml`<lab-switch default-checked>Включено по умолчанию</lab-switch>`),
          )
          .replace(
            '<!-- @@SSR_SWITCH_OFF@@ -->',
            renderToString(litHtml`<lab-switch>Изначально выключено</lab-switch>`),
          )
          .replace(
            '<!-- @@SSR_SWITCH_EXPLICIT_OFF@@ -->',
            renderToString(
              litHtml`<lab-switch .defaultChecked=${true} .checked=${false}>Явно выключено</lab-switch>`,
            ),
          )
          .replace(
            '<!-- @@SSR_SWITCH_MOTION@@ -->',
            renderToString(litHtml`<lab-switch checked>Изначально включено</lab-switch>`),
          )
          .replace(
            '<!-- @@SSR_REACT_SWITCH_MOTION@@ -->',
            renderReactToString(
              createElement(
                StrictMode,
                null,
                createElement(Switch, { checked: true }, 'Изначально включено'),
              ),
            ),
          );
      }
      if (!ctx.path.endsWith('proof.html') || !html.includes(PLACEHOLDER)) return html;
      // Определение элемента должно попасть в общий registry Lit до рендеринга.
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
      const { renderButton } = await import('@labpics/ui-vue/ssr');
      const glyph =
        '<svg data-glyph="start" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor"/></svg>';
      const anatomy = (['s', 'm', 'l'] as const)
        .map((size) =>
          (['plain', 'full', 'empty', 'whitespace'] as const)
            .map((mode) => {
              const body = renderButton(
                { size, description: mode === 'full' ? 'Description' : undefined },
                {
                  default: '<span data-label>Button</span>',
                  icon: mode === 'full' ? glyph : mode === 'whitespace' ? ' ' : '',
                  end:
                    mode === 'full' ? glyph.replace('data-glyph="start"', 'data-glyph="end"') : '',
                },
              );
              return `<div data-testid="ssr-anatomy-${size}-${mode}">${body}</div>`;
            })
            .join(''),
        )
        .join('');
      return markup.replace(
        placeholder,
        renderToString(html`
          <lab-button data-testid="ssr-explicit-default" icon aria-label="Add item"><span>Add</span></lab-button>
          <lab-button data-testid="ssr-default" icon><span>Add</span></lab-button>
          <lab-button data-testid="ssr-explicit" icon aria-label="Add item"></lab-button>
          <lab-button data-testid="ssr-loading" icon loading aria-label="Add item"><span>Add</span></lab-button>
          <lab-button data-testid="ssr-visible" aria-label="Add item"><span>Add</span></lab-button>
        `) + anatomy,
      );
    },
  };
}

function ssrCheckedPlugin(): Plugin {
  const placeholder = '<!-- @@SSR_CHECKED@@ -->';
  return {
    name: 'labui-ssr-checked',
    async transformIndexHtml(markup, ctx) {
      if (!ctx.path.endsWith('boolean-ssr.html') || !markup.includes(placeholder)) return markup;
      const { renderSwitch, renderCheckbox, renderProgress, renderNumberInput, renderTooltip } =
        await import('@labpics/ui-vue/ssr');
      const { renderToString, html } = await import('@labpics/ui-core/ssr');
      registerBooleanExtensions();
      const specimens = [
        [
          'extension-decorated',
          renderToString(html`<lab-boolean-decorated .flag=${false}></lab-boolean-decorated>`),
        ],
        [
          'extension-manual',
          renderToString(html`<lab-boolean-manual .flag=${false}></lab-boolean-manual>`),
        ],
        [
          'extension-data',
          renderToString(html`<lab-boolean-data .flag=${false}></lab-boolean-data>`),
        ],
        [
          'extension-coercing',
          renderToString(html`<lab-boolean-coercing .flag=${false}></lab-boolean-coercing>`),
        ],
        ['progress-value', renderProgress({ value: 40, showValueText: true })],
        ['number-wheel', renderNumberInput({ allowMouseWheel: true })],
        ['tooltip-no-arrow', renderTooltip({ arrow: false }, { default: 'Help' })],
        ['switch-empty', renderSwitch({}, { default: 'Empty' })],
        ['switch-default', renderSwitch({ defaultChecked: true }, { default: 'Default' })],
        [
          'switch-false',
          renderSwitch({ checked: false, defaultChecked: true }, { default: 'False' }),
        ],
        ['checkbox-default', renderCheckbox({ defaultChecked: true }, { default: 'Default' })],
        ['checkbox-mixed', renderCheckbox({ defaultIndeterminate: true }, { default: 'Mixed' })],
        [
          'checkbox-false',
          renderCheckbox({ checked: false, defaultChecked: true }, { default: 'False' }),
        ],
        [
          'checkbox-not-mixed',
          renderCheckbox(
            { indeterminate: false, defaultIndeterminate: true },
            { default: 'Not mixed' },
          ),
        ],
      ];
      return markup.replace(
        placeholder,
        specimens.map(([id, html]) => `<section data-testid="${id}">${html}</section>`).join('\n'),
      );
    },
  };
}

export default defineConfig({
  root: 'src',
  plugins: [
    hydrate(),
    booleanExtensionFixture(),
    ssrProofPlugin(),
    ssrButtonNamesPlugin(),
    ssrCheckedPlugin(),
  ],
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
        'fixture-material-context': resolve(__dirname, 'src/_fixtures/material-context.html'),
        'fixture-card-material-shadow': resolve(
          __dirname,
          'src/_fixtures/card-material-shadow.html',
        ),
        'fixture-card-anatomy': resolve(__dirname, 'src/_fixtures/card-anatomy.html'),
        'fixture-card-backdrop': resolve(__dirname, 'src/_fixtures/card-backdrop.html'),
        'fixture-material-runtime-lifetime': resolve(
          __dirname,
          'src/_fixtures/material-runtime-lifetime.html',
        ),
        'fixture-shadow': resolve(__dirname, 'src/_fixtures/shadow.html'),
        'fixture-proof': resolve(__dirname, 'src/_fixtures/proof.html'),
        'fixture-boolean-ssr': resolve(__dirname, 'src/_fixtures/boolean-ssr.html'),
        'fixture-button-names': resolve(__dirname, 'src/_fixtures/button-names.html'),
        'fixture-button-anatomy': resolve(__dirname, 'src/_fixtures/button-anatomy.html'),
        'fixture-tokens': resolve(__dirname, 'src/_fixtures/tokens.html'),
        'fixture-switch-motion': resolve(__dirname, 'src/_fixtures/switch-motion.html'),
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
