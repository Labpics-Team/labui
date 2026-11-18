import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`shared component CSS permits ${format} imports and server render`, async () => {
    const load = format === 'esm' ? (name) => import(name) : (name) => require(name);
    const { Input } = await load('@labpics/ui-react/input');
    const { Sheet } = await load('@labpics/ui-react/sheet');
    const { Snackbar } = await load('@labpics/ui-react/snackbar');
    const { Card } = await load('@labpics/ui-react/card');
    const { Switch } = await load('@labpics/ui-react/switch');
    const { Badge } = await load('@labpics/ui-react/badge');
    assert.ok(Sheet);
    const output = renderToString(
      createElement(Input, {
        label: 'Почта',
        name: 'email',
        defaultValue: 'studio@example.com',
      }),
    );
    assert.match(output, /studio@example.com/);
    assert.match(output, /Почта/);
    assert.match(output, /name="email"/);
    const notification = renderToString(
      createElement(Snackbar, {
        open: true,
        message: 'Настройки сохранены',
        actionLabel: 'Отменить',
      }),
    );
    assert.match(notification, /Настройки сохранены/);
    assert.match(notification, /Отменить/);
    assert.match(notification, /role="status"/);
    assert.match(notification, />5<\/span>/);
    const card = renderToString(
      createElement(Card, { heading: 'Title', description: 'Description', image: '/image.png' }),
    );
    assert.match(card, /<h2 class="lab-card-title">Title<\/h2>/);
    assert.match(card, /Description/);
    assert.match(card, /src="\/image.png"/);
    const control = renderToString(
      createElement(
        Switch,
        { defaultChecked: true, required: true, name: 'alerts', icon: true, labelStart: 'До' },
        'После',
      ),
    );
    assert.match(control, /role="switch"/);
    assert.match(control, /checked=""/);
    assert.match(control, /name="alerts"/);
    assert.match(control, /До/);
    assert.match(control, /После/);
    const badge = renderToString(createElement(Badge, { color: 'yellow' }, 'Badge'));
    assert.match(badge, /data-color="yellow"/);
    assert.match(badge, /class="lab-badge-label">Badge/);
    assert.doesNotMatch(badge, /role="button"|tabindex/);
  });
}
