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
import type { LabAccordionItem } from '@labpics/ui-core/accordion';
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

// The Lit element takes its panels as a JS property; the panel content is the
// slotted light DOM already in accordion.html. The initial open panel is declared
// as the `default-value="what"` ATTRIBUTE in the markup (present at upgrade time,
// since the machine reads default-value once on connect) — not set late here.
const litAccordion = document.querySelector('lab-accordion');
if (litAccordion) {
  litAccordion.items = DEMO_ITEMS;
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
  </StrictMode>,
);
