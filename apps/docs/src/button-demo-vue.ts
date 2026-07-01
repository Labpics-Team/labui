/*
 * Button parity demo — the Vue half.
 *
 * Mounts the native-Vue <Button> with the SAME specimens as the Lit
 * `<lab-button>` markup in button.html and the React demo, so the Playwright
 * suite can read all three renderers' computed styles and assert they match
 * (visual parity, ADR-0001) — and drive each one's click/keyboard/a11y
 * behaviour.
 *
 * No `.vue` SFC / compiler here: `h()` render functions keep the Vue package
 * (and this demo) buildable with the SAME esbuild pass Vite already runs for
 * the rest of the docs site — no extra plugin, no extra toolchain.
 *
 * The theme switcher is wired once, from button-demo.tsx — this demo only
 * mounts its renderer under the SAME [data-theme] root.
 */
import { Button } from '@labpics/ui-vue';
import { createApp, h } from 'vue';

const mount = document.querySelector<HTMLElement>('#vue-root');
if (!mount) throw new Error('Missing #vue-root mount node in button.html');

const App = {
  render() {
    return [
      h(Button, { 'data-testid': 'vue-accent-fill', type: 'accent', kind: 'fill' }, () => 'Save'),
      h(
        Button,
        { 'data-testid': 'vue-neutral-tinted', type: 'neutral', kind: 'tinted' },
        () => 'Cancel',
      ),
      h(
        Button,
        { 'data-testid': 'vue-danger-border', type: 'danger', kind: 'border' },
        () => 'Delete',
      ),
      h(
        Button,
        { 'data-testid': 'vue-loading', type: 'accent', kind: 'fill', loading: true },
        () => 'Saving',
      ),
      h(
        Button,
        { 'data-testid': 'vue-disabled', type: 'accent', kind: 'fill', disabled: true },
        () => 'Off',
      ),
      // Icon-only: no default-slot content, so the ONLY name source is
      // aria-label, forwarded to the native <button> via attribute fallthrough.
      // The icon slot holds a decorative glyph.
      h(
        Button,
        {
          'data-testid': 'vue-icon-only',
          type: 'accent',
          kind: 'fill',
          icon: true,
          'aria-label': 'Add item',
        },
        {
          icon: () =>
            h(
              'svg',
              {
                viewBox: '0 0 16 16',
                fill: 'none',
                'aria-hidden': 'true',
                width: 16,
                height: 16,
              },
              [
                h('path', {
                  d: 'M8 3v10M3 8h10',
                  stroke: 'currentColor',
                  'stroke-width': 2,
                  'stroke-linecap': 'round',
                }),
              ],
            ),
        },
      ),
      // Default-type button inside a form: clicking must NOT submit (htmlType
      // defaults to "button").
      h('form', { 'data-testid': 'vue-form', onSubmit: (e: Event) => e.preventDefault() }, [
        h(Button, { 'data-testid': 'vue-in-form', type: 'neutral', kind: 'tinted' }, () => 'Plain'),
      ]),
    ];
  },
};

createApp(App).mount(mount);
