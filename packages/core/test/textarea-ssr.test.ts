import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/textarea/index.js';

describe('Textarea server frame', () => {
  it('delivers the initial multiline value, label, description and native constraints', () => {
    const output = renderToString(
      html`<lab-textarea label="Описание" value="Первая&#10;Вторая" name="description" required helper="Подсказка" invalid error="Исправьте" minlength="3"></lab-textarea>`,
    );
    const control = output.match(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/)?.[0] ?? '';
    expect(control).toContain('Первая');
    expect(control).toContain('Вторая');
    expect(control).toContain('name="description"');
    expect(control).toContain('required');
    expect(control).toContain('minlength="3"');
    expect(control).toContain('aria-invalid="true"');
    expect(output).toContain('lab-input-outline');
    expect(output).toContain('Описание');
  });
  it('escapes markup and preserves a leading newline without adding template parts', () => {
    const value = '\n</textarea><script>alert("x")</script> & second\nthird';
    const output = renderToString(
      html`<lab-textarea label="Описание" .value=${value}></lab-textarea>`,
    );
    expect(output).toContain(
      '>\n\n&lt;/textarea&gt;&lt;script&gt;alert("x")&lt;/script&gt; &amp; second\nthird</textarea>',
    );
    expect(output.match(/<textarea\b/g)).toHaveLength(1);
    expect(output.match(/<\/textarea>/g)).toHaveLength(1);
    expect(output).not.toContain('<script>');
  });
  it.each(['\r\n', '\r', '\n'])('preserves the native leading line break %j', (lineBreak) => {
    const output = renderToString(
      html`<lab-textarea .value=${`${lineBreak}First${lineBreak}Second`}></lab-textarea>`,
    );
    expect(output).toContain('>\n\nFirst\nSecond</textarea>');
  });
});
