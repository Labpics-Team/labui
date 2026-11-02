import '@labpics/ui-core/card';
import { Card } from '@labpics/ui-react/card';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

const mount = document.getElementById('react-mount');
if (!mount) throw new Error('Нет React mount');
createRoot(mount).render(
  createElement(
    Card,
    { id: 'react-card', variant: 'elevated', 'aria-label': 'React Card' },
    createElement('div', { className: 'sample', 'aria-hidden': true }),
  ),
);
