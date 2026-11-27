import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/kbd/index.js';

describe('Kbd first server frame', () => {
  it('delivers a single key from the default slot with authored typography', () => {
    const output = renderToString(html`<lab-kbd>Esc</lab-kbd>`);
    expect(output).toContain('data-size="s"');
    expect(output).toContain('font-weight: 500');
    expect(output).toContain('<slot>');
    expect(output).not.toMatch(/font-family-mono|box-shadow:|role="button"|tabindex=|<button/);
  });

  it('keeps each key inside the chord and escapes key labels', () => {
    const output = renderToString(html`<lab-kbd .keys=${['Ctrl', '<K>']} size="l"></lab-kbd>`);
    expect(output.match(/<kbd[ >]/g)).toHaveLength(3);
    expect(output).toContain('&lt;K&gt;');
    expect(output).toContain('data-size="l"');
    expect(output).toContain('keys="[&quot;Ctrl&quot;,&quot;&lt;K&gt;&quot;]"');
  });

  it('normalizes the old medium spelling and preserves an empty-list slot', () => {
    const output = renderToString(html`<lab-kbd size="m" .keys=${[]}>Enter</lab-kbd>`);
    expect(output).toContain('data-size="l"');
    expect(output.match(/<kbd[ >]/g)).toHaveLength(1);
    expect(output).toContain('<slot>');
  });

  it('preserves the single key if a JSON attribute is empty or malformed', () => {
    const output = renderToString(html`<lab-kbd keys="">Esc</lab-kbd>`);
    expect(output.match(/<kbd[ >]/g)).toHaveLength(1);
    expect(output).toContain('<slot>');
  });
});
