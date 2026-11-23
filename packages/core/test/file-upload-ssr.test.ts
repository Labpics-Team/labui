import { expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/file-upload/index.js';

it('renders the authored upload surface before hydration without serializing local file objects', () => {
  const empty = renderToString(
    html`<lab-file-upload label="Attachments" view="dropzone" disabled></lab-file-upload>`,
  );
  expect(empty).toContain('shadowrootmode');
  expect(empty).toContain('Drag and drop files here');
  expect(empty).toContain('Browse files');
  expect(empty).toContain('data-disabled');
  expect(empty).toContain('type="file"');
  expect(() =>
    renderToString(
      html`<lab-file-upload label="Attachments" .defaultAcceptedFiles=${[new File(['body'], '<report>.txt', { type: 'text/plain' })]}></lab-file-upload>`,
    ),
  ).toThrow('not a JSON-serializable SSR input');
});
