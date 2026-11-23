import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  test(`FileUpload ${format} renders without browser globals and preserves selected filenames`, async () => {
    const { FileUpload } =
      format === 'esm'
        ? await import('@labpics/ui-react/file-upload')
        : require('@labpics/ui-react/file-upload');
    const empty = renderToString(
      createElement(FileUpload, {
        label: 'Attachments',
        name: 'files',
        view: 'dropzone',
        disabled: true,
      }),
    );
    assert.match(empty, /Drag and drop files here/);
    assert.match(empty, /Browse files/);
    assert.match(empty, /name="files"/);
    assert.match(empty, /type="file"/);
    assert.match(empty, /disabled=""/);
    const selected = renderToString(
      createElement(FileUpload, {
        label: 'Attachments',
        defaultAcceptedFiles: [new File(['body'], '<report>.txt', { type: 'text/plain' })],
      }),
    );
    assert.match(selected, /&lt;report&gt;\.txt/);
    assert.doesNotMatch(selected, /No file chosen/);
  });
}
