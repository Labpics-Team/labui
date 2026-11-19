import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import '@labpics/ui-core/ssr';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`React ${format} Card renders after the Lit SSR entrypoint`, async () => {
    const { Card } =
      format === 'esm' ? await import('@labpics/ui-react/card') : require('@labpics/ui-react/card');
    const output = renderToString(createElement(Card, { heading: 'Общее пространство' }));
    assert.match(output, /<h2 class="lab-card-title">Общее пространство<\/h2>/);
  });
}
