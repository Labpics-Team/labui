import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`Breadcrumb ${format} renders stable native navigation and escaped labels on the server`, async () => {
    const { Breadcrumb } =
      format === 'esm'
        ? await import('@labpics/ui-react/breadcrumb')
        : require('@labpics/ui-react/breadcrumb');
    const items = [
      { label: 'Home', href: '/home' },
      { label: 'Team', href: '/team' },
      { label: 'Projects', href: '/projects' },
      { label: 'Services', href: '/services' },
      { label: '<Design> & Research', href: '/current-must-not-link' },
    ];
    const props = { items, 'aria-label': 'Project hierarchy' };
    const collapsed = renderToString(createElement(Breadcrumb, props));
    assert.match(collapsed, /aria-label="Project hierarchy"/);
    assert.match(collapsed, /&lt;Design&gt; &amp; Research/);
    assert.match(collapsed, /aria-current="page"/);
    assert.match(collapsed, /type="button"/);
    assert.doesNotMatch(collapsed, /href="\/(team|projects|current-must-not-link)"/);
    assert.equal((collapsed.match(/<li\b/g) ?? []).length, 4);
    const full = renderToString(createElement(Breadcrumb, { ...props, maxItems: 0 }));
    assert.match(full, /href="\/team"/);
    assert.match(full, /href="\/projects"/);
    assert.doesNotMatch(full, /<button\b/);
    assert.equal((full.match(/<li\b/g) ?? []).length, 5);
  });
}
