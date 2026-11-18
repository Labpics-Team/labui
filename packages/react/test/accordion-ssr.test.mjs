import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Fragment, createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`Accordion ${format} retains panels, headings and controlled empty selection`, async () => {
    const { Accordion, AccordionItem } =
      format === 'esm'
        ? await import('@labpics/ui-react/accordion')
        : require('@labpics/ui-react/accordion');
    const children = h(
      Fragment,
      null,
      h(
        AccordionItem,
        { value: 'draft', label: 'Draft' },
        h('textarea', { defaultValue: 'Unfinished draft' }),
      ),
      h(AccordionItem, { value: 'history', label: 'History' }, 'History'),
    );
    const output = renderToString(
      h(Accordion, { defaultValue: ['draft'], headingLevel: 2 }, children),
    );
    assert.equal([...output.matchAll(/<h2\b/g)].length, 2);
    assert.equal([...output.matchAll(/aria-expanded="true"/g)].length, 1);
    assert.equal([...output.matchAll(/hidden=""/g)].length, 1);
    assert.match(output, /Unfinished draft/);
    const empty = renderToString(h(Accordion, { value: [], defaultValue: ['draft'] }, children));
    assert.doesNotMatch(empty, /aria-expanded="true"/);
    assert.equal([...empty.matchAll(/hidden=""/g)].length, 2);
  });
}
