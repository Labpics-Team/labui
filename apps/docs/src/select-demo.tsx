/*
 * Select parity demo — the React half.
 *
 * Mounts the native-React <Select> with the SAME specimens as the Lit `<lab-select>`
 * markup in select.html, so the Playwright suite can drive each renderer's machine
 * (open on click, navigation, selection, Escape / outside-click dismiss, positioning)
 * and read both listboxes' computed styles (visual parity, ADR-0001).
 */
import '@labpics/ui-core/select';
import type { LabSelectItem } from '@labpics/ui-core/select';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Select } from '@labpics/ui-react/select';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const FRUITS: LabSelectItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
];

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in select.html');

function FormExample() {
  const [value, setValue] = useState(['', 'banana']);
  const [request, setRequest] = useState<string[]>([]);
  const [accept, setAccept] = useState(false);
  const options = [{ value: '', label: 'Empty key' }, ...FRUITS];
  return (
    <form data-testid="react-select-form">
      <fieldset>
        <Select
          label="Team"
          name="team"
          multiple
          required
          value={value}
          items={options}
          onValueChange={(next) => {
            setRequest(next);
            if (accept) setValue(next);
          }}
        />
        <Select
          label="Initial team"
          name="initial"
          multiple
          defaultValue={['banana']}
          items={options}
        />
        <Select label="Empty key single" defaultValue={['banana']} items={options} />
      </fieldset>
      <output data-testid="select-request">{JSON.stringify(request)}</output>
      <button type="button" onClick={() => setAccept(!accept)}>
        Accept changes
      </button>
      <button type="button" onClick={() => setValue(request)}>
        Apply request
      </button>
      <button type="reset">Reset</button>
    </form>
  );
}

function ExternalFormExample() {
  const [form, setForm] = useState('select-form-a');
  return (
    <section data-testid="select-form-association">
      <form id="select-form-a" />
      <form id="select-form-b" />
      <Select
        label="External choice"
        name="choice"
        form={form}
        multiple
        defaultValue={['banana']}
        items={FRUITS}
      />
      <button type="button" onClick={() => setForm('select-form-b')}>
        Associate with B
      </button>
    </section>
  );
}

// The testid rides on a wrapper; the spec targets `.lab-select-trigger` inside each
// wrapper and the portalled `.lab-select-content` in <body>.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-select">
      <Select label="Fruit" placeholder="Pick a fruit…" defaultValue={['banana']} items={FRUITS} />
    </span>
    <span data-testid="react-select-multi">
      <Select label="Fruits" placeholder="Pick fruits…" multiple items={FRUITS.slice(0, 3)} />
    </span>
    <FormExample />
    <ExternalFormExample />
    <fieldset disabled data-testid="select-disabled-ancestors">
      <legend>
        Exception <Select label="Legend choice" items={FRUITS} />
      </legend>
      <fieldset>
        <Select label="Nested choice" items={FRUITS} />
      </fieldset>
    </fieldset>
  </StrictMode>,
);
