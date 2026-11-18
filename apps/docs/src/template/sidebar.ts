import { el } from './dom.js';
import { CATALOG, type Registry } from './registry.js';

export function renderSidebar(registry: Registry, activeSlug: string): HTMLElement {
  const link = (slug: string, title: string) =>
    el(
      'a',
      {
        class: 'nav-link',
        href: slug ? `?component=${encodeURIComponent(slug)}` : 'components.html',
        'aria-current': activeSlug === slug ? 'page' : undefined,
      },
      [title],
    );
  const groups = CATALOG.groups.map((group) =>
    el(
      'details',
      {
        class: 'nav-group',
        open: registry.some((entry) => entry.group === group.id && entry.slug === activeSlug),
      },
      [
        el('summary', { class: 'sidebar-title', id: `nav-${group.id}` }, [group.title]),
        el(
          'ul',
          { 'aria-labelledby': `nav-${group.id}` },
          registry
            .filter((entry) => entry.group === group.id)
            .map((entry) => el('li', {}, [link(entry.slug, entry.title)])),
        ),
      ],
    ),
  );
  return el('nav', { class: 'doc-sidebar', 'aria-label': 'Компоненты' }, [
    el('a', { class: 'catalog-home', href: 'index.html' }, ['LabUI']),
    link('', 'Каталог компонентов'),
    ...groups,
  ]);
}
