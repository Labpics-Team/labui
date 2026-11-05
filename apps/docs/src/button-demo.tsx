/*
 * Button parity demo — the React half.
 *
 * Mounts the native-React <Button> with the SAME specimens as the Lit
 * `<lab-button>` markup in button.html, so the Playwright suite can read both
 * renderers' computed styles and assert they match (visual parity, ADR-0001) —
 * and drive each one's click/keyboard/a11y behaviour.
 *
 * It also registers the Lit element (side-effect import) and wires the theme
 * switcher, so the single page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/button';
import '@labpics/fonts/fonts.css';
import { Button } from '@labpics/ui-react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bootColors } from './colors-runtime.js';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
bootColors();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in button.html');

createRoot(mount).render(
  <StrictMode>
    <Button data-testid="react-accent-fill" type="accent" kind="fill">
      Save
    </Button>
    <Button data-testid="react-neutral-tinted" type="neutral" kind="tinted">
      Cancel
    </Button>
    <Button data-testid="react-danger-border" type="danger" kind="border">
      Delete
    </Button>
    <Button data-testid="react-neutral-ghost" type="neutral" kind="ghost">
      Details
    </Button>
    <Button data-testid="react-loading" type="accent" kind="fill" loading>
      Saving
    </Button>
    <Button data-testid="react-disabled" type="accent" kind="fill" disabled>
      Off
    </Button>
    {/* Icon-only: no children, so the ONLY name source is aria-label, forwarded
        to the native <button> via {...rest}. The iconSlot holds a decorative glyph. */}
    <Button
      data-testid="react-icon-only"
      type="accent"
      kind="fill"
      icon
      aria-label="Add item"
      iconSlot={
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width={16} height={16}>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      }
    />
    {/* Default-type button inside a form: clicking must NOT submit (htmlType
        defaults to "button"). */}
    <form data-testid="react-form" onSubmit={(e) => e.preventDefault()}>
      <Button data-testid="react-in-form" type="neutral" kind="tinted">
        Plain
      </Button>
    </form>
  </StrictMode>,
);

// Одинаковые входы проходят через публичные API обоих рендереров.
const geometrySizes = ['s', 'm', 'l'] as const;
const geometryModes = ['text', 'leading', 'icon'] as const;
const iconPath = 'M8 3v10M3 8h10';
const litGeometry = document.querySelector('#geometry-lit');
const reactGeometry = document.querySelector('#geometry-react');
if (!litGeometry || !reactGeometry) throw new Error('Missing Button geometry mounts');

for (const size of geometrySizes) {
  const row = document.createElement('div');
  row.className = 'geometry-row';
  for (const mode of geometryModes) {
    for (const loading of [false, true]) {
      const button = document.createElement('lab-button');
      button.size = size;
      button.icon = mode === 'icon';
      button.loading = loading;
      button.addEventListener('click', () => {
        button.loading = true;
      });
      button.dataset.testid = `lit-geometry-${size}-${mode}${loading ? '-loading' : ''}`;
      if (mode === 'icon') button.setAttribute('aria-label', 'Add item');
      if (mode !== 'text') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('slot', 'icon');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', iconPath);
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        svg.append(path);
        button.append(svg);
      }
      if (mode !== 'icon') {
        const label = document.createElement('span');
        label.dataset.fixtureLabel = '';
        label.textContent = 'Button';
        button.append(label);
      }
      row.append(button);
    }
  }
  litGeometry.append(row);
}

createRoot(reactGeometry).render(
  <StrictMode>
    {geometrySizes.map((size) => (
      <div key={size} className="geometry-row">
        {geometryModes.flatMap((mode) =>
          [false, true].map((loading) => (
            <GeometryButton
              key={`${mode}-${loading}`}
              data-testid={`react-geometry-${size}-${mode}${loading ? '-loading' : ''}`}
              size={size}
              mode={mode}
              initialLoading={loading}
            />
          )),
        )}
      </div>
    ))}
  </StrictMode>,
);

function GeometryButton({
  size,
  mode,
  initialLoading,
  ...rest
}: {
  size: (typeof geometrySizes)[number];
  mode: (typeof geometryModes)[number];
  initialLoading: boolean;
  'data-testid': string;
}) {
  const [loading, setLoading] = useState(initialLoading);
  return (
    <Button
      {...rest}
      size={size}
      icon={mode === 'icon'}
      loading={loading}
      onClick={() => setLoading(true)}
      aria-label={mode === 'icon' ? 'Add item' : undefined}
      iconSlot={
        mode !== 'text' ? (
          <svg viewBox="0 0 16 16" width={16} height={16} fill="none" aria-hidden="true">
            <path d={iconPath} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        ) : undefined
      }
    >
      {mode !== 'icon' && <span data-fixture-label="">Button</span>}
    </Button>
  );
}

const namesMount = document.querySelector('#button-names');
if (!namesMount) throw new Error('Missing Button name specimens');
createRoot(namesMount).render(<ButtonNames />);

function ButtonNames() {
  const [icon, setIcon] = useState(true);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <label>
        <input
          type="checkbox"
          data-testid="names-icon"
          checked={icon}
          onChange={(event) => setIcon(event.currentTarget.checked)}
        />
        Только иконка
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="names-loading"
          checked={loading}
          onChange={(event) => setLoading(event.currentTarget.checked)}
        />
        Загрузка
      </label>
      {(['explicit-default', 'default', 'explicit'] as const).map((name) => (
        <Button
          key={name}
          data-testid={`react-name-${name}`}
          icon={icon}
          loading={loading}
          aria-label={name !== 'default' ? 'Add item' : undefined}
          iconSlot={
            <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
              <path d={iconPath} stroke="currentColor" />
            </svg>
          }
        >
          {name !== 'explicit' && <span>Add</span>}
        </Button>
      ))}
    </>
  );
}
