/*
 * Accordion parity demo — the React half (and the Lit `.items` wiring).
 *
 * Mounts the native-React <Accordion> with the SAME specimens as the Lit
 * `<lab-accordion>` markup in accordion.html, so the Playwright suite can read both
 * renderers' computed styles (visual parity, ADR-0001) and drive each one's machine
 * behaviour (click / arrow-key open/close).
 *
 * It also registers the Lit element (side-effect import), sets its `.items` and
 * `.defaultValue` properties (panels are declared as data, not slotted triggers),
 * and wires the theme switcher, so the single page carries both renderers under one
 * [data-theme].
 */
import '@labpics/ui-core/accordion';
import type { LabAccordion, LabAccordionItem } from '@labpics/ui-core/accordion';
import { Accordion, AccordionItem } from '@labpics/ui-react/accordion';
import { StrictMode } from 'react';
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

const DEMO_ITEMS: ReadonlyArray<LabAccordionItem> = [
  { value: 'what', label: 'What is LabUI?' },
  { value: 'how', label: 'How does theming work?' },
  { value: 'ssr', label: 'Is it SSR-ready?', disabled: true },
];

// The disclosure-axes specimens (multiple, collapsible) use three ENABLED panels,
// so Home/End land on genuine first/last headers (no disabled item to skip). The
// same item set drives both, paired with each Lit host by its `default-value`.
const AXIS_ITEMS: ReadonlyArray<LabAccordionItem> = [
  { value: 'one', label: 'Panel one' },
  { value: 'two', label: 'Panel two' },
  { value: 'three', label: 'Panel three' },
];

// The Lit element takes its panels as a JS property; the panel content is the
// slotted light DOM already in accordion.html. The initial open panel is declared
// as the `default-value="what"` ATTRIBUTE in the markup (present at upgrade time,
// since the machine reads default-value once on connect) — not set late here. The
// `multiple` / `collapsible` axes are likewise declared as ATTRIBUTES in the
// markup (read once on connect); here we only feed each host its `.items`.
const litAccordion = document.querySelector<LabAccordion>(
  '[data-testid="lit-accordion"]',
);
if (litAccordion) {
  litAccordion.items = DEMO_ITEMS;
}
for (const testid of ['lit-accordion-multiple', 'lit-accordion-collapsible']) {
  const host = document.querySelector<LabAccordion>(`[data-testid="${testid}"]`);
  if (host) host.items = AXIS_ITEMS;
}

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in accordion.html');

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-accordion">
      <Accordion defaultValue={['what']}>
        <AccordionItem value="what" label="What is LabUI?">
          A cross-stack component system: one Lit core, native renderers per framework.
        </AccordionItem>
        <AccordionItem value="how" label="How does theming work?">
          Components read only semantic --lab-* roles; flipping the theme re-skins everything.
        </AccordionItem>
        <AccordionItem value="ssr" label="Is it SSR-ready?" disabled>
          Yes — the declarative shadow DOM emits styled content before any JS upgrades it.
        </AccordionItem>
      </Accordion>
    </span>

    {/* MULTIPLE: many panels open at once. Three enabled headers so Home/End land
        on genuine first/last triggers. */}
    <span data-testid="react-accordion-multiple">
      <Accordion multiple defaultValue={['one']}>
        <AccordionItem value="one" label="Panel one">
          First panel — opening a second leaves this one open in multi mode.
        </AccordionItem>
        <AccordionItem value="two" label="Panel two">
          Second panel — both can be open at the same time.
        </AccordionItem>
        <AccordionItem value="three" label="Panel three">
          Third panel — End focuses this last header.
        </AccordionItem>
      </Accordion>
    </span>

    {/* COLLAPSIBLE: single mode, but the one open panel can close back to none. */}
    <span data-testid="react-accordion-collapsible">
      <Accordion collapsible defaultValue={['one']}>
        <AccordionItem value="one" label="Panel one">
          First panel — clicking its open header closes it to none.
        </AccordionItem>
        <AccordionItem value="two" label="Panel two">
          Second panel.
        </AccordionItem>
        <AccordionItem value="three" label="Panel three">
          Third panel — End focuses this last header.
        </AccordionItem>
      </Accordion>
    </span>
  </StrictMode>,
);
