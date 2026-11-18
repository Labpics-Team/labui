import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/tabs/index.js';

const items = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
];
describe('Tabs server frame', () => {
  it('reads the serializable tab model from HTML, including flags and escaped labels', () => {
    const model = [
      { value: 'first', label: 'A < B & "quoted"', icon: 'start', iconEnd: 'end', iconOnly: true },
      { value: 'second', label: 'Second', disabled: true },
    ];
    const output = renderToString(
      html`<lab-tabs items=${JSON.stringify(model)} default-value="first"></lab-tabs>`,
    );
    const tabs = [...output.matchAll(/<button\b[^>]+>/g)].map((match) => match[0]);
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toContain('data-icon-only');
    expect(tabs[1]).toContain('disabled');
    expect(output).toContain('A &lt; B &amp; &quot;quoted&quot;');
    expect(output).toContain('name="start"');
    expect(output).toContain('name="end"');
  });
  it.each([
    '{',
    'null',
    '{}',
    '[null]',
    '[{"value":"a"}]',
    '[{"value":"a","label":"A","disabled":"false"}]',
  ])('rejects malformed tab data from HTML: %s', (model) => {
    const output = renderToString(html`<lab-tabs items=${model}></lab-tabs>`);
    expect(output).not.toContain('role="tab"');
  });
  it('delivers labelled tabs, the selected panel and a hidden mounted second panel', () => {
    const output = renderToString(
      html`<lab-tabs .items=${items} default-value="first" label="Views"><input slot="first" value="Draft"><p slot="second">Other</p></lab-tabs>`,
    );
    const tabs = [...output.matchAll(/<button\b[^>]+>/g)].map((m) => m[0]);
    const panels = [...output.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>/g)].map((m) => m[0]);
    expect(tabs).toHaveLength(2);
    expect(panels).toHaveLength(2);
    expect(output).toContain('aria-label="Views"');
    expect(tabs[0]).toContain('aria-selected="true"');
    expect(tabs[1]).toContain('aria-selected="false"');
    expect(panels[0]).not.toMatch(/\shidden/);
    expect(panels[1]).toMatch(/\shidden/);
    const id = tabs[0]?.match(/aria-controls="([^"]+)"/)?.[1];
    expect(panels[0]).toContain(`id="${id}"`);
    expect(output).not.toContain('undefined');
  });
  it('retains controlled null instead of activating defaultValue', () => {
    const output = renderToString(
      html`<lab-tabs .items=${items} .value=${null} default-value="first"></lab-tabs>`,
    );
    expect(output).not.toContain('aria-selected="true"');
    expect(output.match(/role="tabpanel"[^>]*hidden/g)).toHaveLength(2);
    expect(output.match(/<button[^>]*tabindex="0"/g)).toHaveLength(1);
  });
  it('gives adjacent instances unique relationship ids', () => {
    const output = renderToString(
      html`<lab-tabs .items=${items} default-value="first"></lab-tabs><lab-tabs .items=${items} default-value="first"></lab-tabs>`,
    );
    const ids = [...output.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
