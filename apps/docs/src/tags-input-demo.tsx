/*
 * Tags Input parity demo — the React half.
 *
 * Mounts the native-React <TagsInput> with the SAME specimens as the Lit `<lab-tags-input>`
 * markup in tags-input.html, so the Playwright suite can drive each renderer's machine
 * (Enter adds, Backspace removes, the chip × removes, navigation) and read both renderers'
 * computed styles (visual parity, ADR-0001) and the SAME field-a11y wiring.
 *
 * The event specimen surfaces the public onValueChange payload into a readout node so the
 * suite can assert the value-change EVENT fires with the tag set on BOTH renderers.
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher, so the
 * page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/tags-input';
import { TagsInput } from '@labpics/ui-react/tags-input';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.documentElement;

const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

const select = document.querySelector<HTMLSelectElement>('[data-testid="theme-select"]');
if (select) {
  const current = root.getAttribute('data-theme');
  if (current) select.value = current;
  select.addEventListener('change', () => {
    if (isTheme(select.value)) root.setAttribute('data-theme', select.value);
  });
}

/** A tags input wired to a readout so the suite can assert the public value-change EVENT. */
function TagsInputWithEventReadout(): React.ReactNode {
  const [tags, setTags] = useState('');
  return (
    <span data-testid="react-tags-event">
      <TagsInput
        label="Tags"
        placeholder="Add a tag…"
        onValueChange={(value) => setTags(value.join(','))}
      />
      <output data-testid="react-tags-event-value">{tags}</output>
    </span>
  );
}

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in tags-input.html');

// Test ids ride on wrappers (the TagsInput owns its prop API — no passthrough). The spec
// targets the `[data-lab-tags-input]` field inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-neutral">
      <TagsInput
        label="Tags"
        placeholder="Add a tag…"
        helper="Press Enter or comma to add a tag."
        defaultValue={['design', 'system']}
      />
    </span>
    <span data-testid="react-invalid">
      <TagsInput
        type="danger"
        invalid
        label="Tags"
        placeholder="Add a tag…"
        error="Too many tags."
        defaultValue={['one', 'two']}
      />
    </span>
    <span data-testid="react-required">
      <TagsInput label="Keywords" required placeholder="Add a keyword…" />
    </span>
    <span data-testid="react-disabled">
      <TagsInput label="Locked" disabled defaultValue={['fixed']} />
    </span>
    <span data-testid="react-size-s">
      <TagsInput size="s" label="Small" defaultValue={['a']} />
    </span>
    <span data-testid="react-size-l">
      <TagsInput size="l" label="Large" defaultValue={['a']} />
    </span>
    <span data-testid="react-duplicates">
      <TagsInput label="Duplicates" allowDuplicates defaultValue={['dup', 'dup', 'solo']} />
    </span>
    <TagsInputWithEventReadout />
  </StrictMode>,
);
