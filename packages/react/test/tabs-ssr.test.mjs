import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Fragment, createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`Tabs ${format} delivers a named tablist, mounted panels and controlled null`, async () => {
    const { Tabs, Tab, TabPanel } =
      format === 'esm' ? await import('@labpics/ui-react/tabs') : require('@labpics/ui-react/tabs');
    const children = [
      h(
        Fragment,
        { key: 'tabs' },
        h(Tab, { value: 'draft' }, 'Draft'),
        h(Tab, { value: 'history' }, 'History'),
      ),
      h(
        TabPanel,
        { key: 'draft', value: 'draft' },
        h('textarea', { defaultValue: 'Unfinished draft' }),
      ),
      h(TabPanel, { key: 'history', value: 'history' }, 'History'),
    ];
    const output = renderToString(
      h(Tabs, { defaultValue: 'draft', variant: 'tinted', label: 'Views' }, children),
    );
    assert.match(output, /aria-label="Views"/);
    assert.equal([...output.matchAll(/role="tab"/g)].length, 2);
    assert.equal([...output.matchAll(/role="tabpanel"/g)].length, 2);
    assert.equal([...output.matchAll(/hidden=""/g)].length, 1);
    assert.match(output, /Unfinished draft/);
    const empty = renderToString(h(Tabs, { value: null, defaultValue: 'draft' }, children));
    assert.doesNotMatch(empty, /aria-selected="true"/);
    assert.equal([...empty.matchAll(/hidden=""/g)].length, 2);
    assert.equal([...empty.matchAll(/<button[^>]*tabindex="0"/g)].length, 1);
  });
}
