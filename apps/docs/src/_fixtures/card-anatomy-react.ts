import { Button } from '@labpics/ui-react/button';
import { Card } from '@labpics/ui-react/card';
import { createElement } from 'react';
import type { CardSpec } from './card-anatomy-cases';

export function reactCard(spec: CardSpec) {
  const footerProps = { type: 'accent' as const, 'data-probe': 'footer' };
  return createElement(
    Card,
    {
      ...spec.props,
      id: `react-${spec.id}`,
      style: { width: spec.width ?? 400, height: spec.height },
      header: spec.header
        ? createElement('h3', { 'data-probe': 'header' }, 'Своя шапка')
        : undefined,
      media: spec.media
        ? createElement('div', { 'data-probe': 'media' }, 'Своя медиа-область')
        : spec.props?.media,
      footer: spec.footer ? createElement(Button, footerProps, 'Открыть') : undefined,
    },
    spec.body ? createElement('div', { 'data-probe': 'body' }, 'Своё содержимое') : undefined,
  );
}
