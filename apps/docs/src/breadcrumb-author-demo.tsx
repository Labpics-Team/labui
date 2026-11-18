import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumbItem, LabBreadcrumbSize } from '@labpics/ui-core/breadcrumb';
import { Breadcrumb } from '@labpics/ui-react/breadcrumb';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const query = new URLSearchParams(location.search);
const size = (query.get('size') ?? 'm') as LabBreadcrumbSize;
const long = query.has('long');
const items: LabBreadcrumbItem[] = long
  ? [
      { label: 'Все рабочие пространства', href: '#home' },
      { label: 'Оченьдлинноеназваниепроектабезпробелов', href: '#team' },
      { label: 'Исследования и проектирование интерфейсов' },
    ]
  : [
      { label: 'Home', href: '#home' },
      { label: 'Team', href: '#team' },
      { label: 'Projects', href: '#projects' },
      { label: 'Services', href: '#services' },
      { label: 'Design' },
    ];
const scale = Number(query.get('scale') ?? 1);
const maxItems = query.has('maxItems') ? Number(query.get('maxItems')) : undefined;
if (query.has('group') && items[1]) items[1] = { label: items[1].label };
document.documentElement.style.fontSize = `${16 * scale}px`;
document.documentElement.dir = query.get('dir') ?? 'ltr';
document.documentElement.dataset.theme = query.get('theme') ?? 'light';
const lit = document.querySelector('lab-breadcrumb');
if (lit) {
  lit.items = items;
  lit.size = size;
  if (maxItems !== undefined) lit.maxItems = maxItems;
}
const mount = document.querySelector('#react-author');
if (!mount) throw new Error('Missing Breadcrumb mount');
createRoot(mount).render(
  <StrictMode>
    <Breadcrumb items={items} size={size} maxItems={maxItems} />
  </StrictMode>,
);
