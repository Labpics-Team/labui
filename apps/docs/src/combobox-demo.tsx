/*
 * Combobox parity demo — the React half.
 *
 * Mounts the native-React <Combobox> with the SAME specimens as the Lit `<lab-combobox>`
 * markup in combobox.html, so the Playwright suite can drive each renderer's machine
 * (open, filter on type, navigation, selection, Escape / outside-click dismiss,
 * positioning) and read both listboxes' computed styles (visual parity, ADR-0001).
 *
 * The event specimen surfaces the public onValueChange payload into a readout node so
 * the suite can assert the value-change EVENT fires with the selected value on BOTH
 * renderers (the tabs.spec event-contract pattern).
 */
import '@labpics/ui-core/combobox';
import type { LabComboboxItem } from '@labpics/ui-core/combobox';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Combobox } from '@labpics/ui-react/combobox';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const FRUITS: LabComboboxItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
];

/** A combobox wired to a readout so the suite can assert the public value-change EVENT. */
function ComboboxWithEventReadout(): React.ReactNode {
  const [selected, setSelected] = useState('');
  return (
    <span data-testid="react-combobox-event">
      <Combobox
        label="Fruit"
        placeholder="Search a fruit…"
        items={FRUITS}
        onValueChange={(value) => setSelected(value.join(','))}
      />
      <output data-testid="react-combobox-event-value">{selected}</output>
    </span>
  );
}

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in combobox.html');

// The testid rides on a wrapper; the spec targets `.lab-combobox-input` inside each
// wrapper and the portalled `.lab-combobox-content` in <body>.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-combobox">
      <Combobox
        label="Fruit"
        placeholder="Search a fruit…"
        helper="Type to filter the list."
        items={FRUITS}
      />
    </span>
    <span data-testid="react-combobox-multi">
      <Combobox label="Fruits" placeholder="Search fruits…" multiple items={FRUITS.slice(0, 4)} />
    </span>
    <ComboboxWithEventReadout />
  </StrictMode>,
);
