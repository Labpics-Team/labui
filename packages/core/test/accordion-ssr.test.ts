import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/accordion/index.js';

const items = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
];
describe('Accordion server frame', () => {
  it('delivers one open panel and its heading relationships without JavaScript', () => {
    const output = renderToString(
      html`<lab-accordion .items=${items} .defaultValue=${['first']} heading-level="2"><input slot="first" value="Draft"></lab-accordion>`,
    );
    const buttons = [...output.matchAll(/<button\b[^>]+>/g)].map((match) => match[0]);
    const panels = [
      ...output.matchAll(/<div\b[^>]*class="content lab-accordion-content"[^>]*>/g),
    ].map((match) => match[0]);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain('aria-expanded="true"');
    expect(buttons[1]).toContain('aria-expanded="false"');
    expect(panels[0]).not.toMatch(/\shidden/);
    expect(panels[1]).toMatch(/\shidden/);
    expect(panels[1]).toMatch(/\sinert/);
    expect(output.match(/role="heading" aria-level="2"/g)).toHaveLength(2);
    const id = buttons[0]?.match(/aria-controls="([^"]+)"/)?.[1];
    expect(panels[0]).toContain(`id="${id}"`);
  });
  it('preserves controlled empty selection over an open default', () => {
    const output = renderToString(
      html`<lab-accordion .items=${items} .value=${[]} .defaultValue=${['first']}></lab-accordion>`,
    );
    expect(output).not.toMatch(/<button\b[^>]*aria-expanded="true"/);
    expect(output.match(/class="content lab-accordion-content"[^>]*hidden/g)).toHaveLength(2);
  });
  it('reads items and open values directly from HTML', () => {
    const output = renderToString(
      html`<lab-accordion items=${JSON.stringify(items)} default-value='["second"]'></lab-accordion>`,
    );
    expect(output.match(/<button\b[^>]*aria-expanded="true"/g)).toHaveLength(1);
    expect(output).toContain('Second');
  });
  it('avoids excessive region landmarks in a group that can open many panels', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      value: String(index),
      label: `Section ${index}`,
    }));
    const output = renderToString(html`<lab-accordion multiple .items=${many}></lab-accordion>`);
    expect(output).not.toContain('role="region"');
    expect(output.match(/role="heading"/g)).toHaveLength(7);
  });
});
