/*
 * Sidebar navigation — built entirely from the registry.
 *
 * Documented components are links (`?component=<slug>`); planned components are
 * non-interactive, dimmed markers so the nav stays HONEST — a "coming soon" item
 * is not a dead link the user can click into a 404. The active component is
 * marked with `aria-current="page"` for assistive tech and styling.
 */
import { el } from './dom.js';
import type { Registry } from './registry.js';

/** Render the `<nav>` for the whole registry, marking `activeSlug` current. */
export function renderSidebar(registry: Registry, activeSlug: string): HTMLElement {
  const items = registry.map((entry) => {
    if (entry.kind === 'planned') {
      return el('li', {}, [
        el('span', { class: 'nav-link nav-planned', 'aria-disabled': 'true' }, [entry.title]),
      ]);
    }
    const isActive = entry.doc.slug === activeSlug;
    return el('li', {}, [
      el(
        'a',
        {
          class: 'nav-link',
          href: `?component=${encodeURIComponent(entry.doc.slug)}`,
          'aria-current': isActive ? 'page' : undefined,
        },
        [entry.doc.title],
      ),
    ]);
  });

  return el('nav', { class: 'doc-sidebar', 'aria-label': 'Components' }, [
    el('p', { class: 'sidebar-title', id: 'sidebar-title' }, ['LabUI components']),
    el('ul', { 'aria-labelledby': 'sidebar-title' }, items),
  ]);
}
