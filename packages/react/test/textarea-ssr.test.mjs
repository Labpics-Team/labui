import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`Textarea ${format} supports Node SSR and preserves escaped multiline content`, async () => {
    const { Textarea } =
      format === 'esm'
        ? await import('@labpics/ui-react/textarea')
        : require('@labpics/ui-react/textarea');
    const output = renderToString(
      createElement(Textarea, {
        label: 'Описание',
        name: 'notes',
        defaultValue: '\nFirst </textarea> & second\n日本語',
        required: true,
        autoResize: true,
        minLength: 3,
      }),
    );
    assert.match(output, /name="notes"/);
    assert.match(output, /minlength="3"/i);
    assert.match(output, /\n\nFirst &lt;\/textarea&gt; &amp; second\n日本語<\/textarea>/);
    assert.match(output, /lab-input-outline/);
    for (const lineBreak of ['\r\n', '\r', '\n']) {
      const normalized = renderToString(
        createElement(Textarea, {
          label: 'Notes',
          defaultValue: `${lineBreak}First${lineBreak}Second`,
        }),
      );
      assert.match(normalized, />\n\nFirst\nSecond<\/textarea>/);
    }
  });
}
