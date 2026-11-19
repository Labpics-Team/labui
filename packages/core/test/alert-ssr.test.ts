import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/alert/index.js';
import { alertQuantity } from '../src/components/alert/contract.js';

describe('Alert SSR', () => {
  it('retains text, material anatomy and dismiss semantics before upgrade', () => {
    const output = renderToString(
      html`<lab-alert heading="Saved" description="Your changes are available" quantity="3" type="danger"></lab-alert>`,
    );
    expect(output).toContain('Saved');
    expect(output).toContain('Your changes are available');
    expect(output).toContain('lab-material--elevated');
    expect(output).toContain('lab-material--base');
    expect(output).toContain('lab-material--muted');
    expect(output).toContain('type="button"');
    expect(output).toContain('role="status"');
    expect(output).not.toContain('role="dialog"');
  });
  it('keeps explicit false for default-true properties in server markup', () => {
    const output = renderToString(
      html`<lab-alert .open=${false} .showIcon=${false} heading="Hidden"></lab-alert>`,
    );
    expect(output).toMatch(/data-lab-alert[^>]*hidden/);
    expect(output).not.toContain('part="icon"');
  });
  it('clamps decorative depth with bounded work', () => {
    for (const [input, expected] of [
      [0, 1],
      [-5, 1],
      [2.8, 2],
      [1e9, 3],
      [Number.NaN, 1],
      [Number.POSITIVE_INFINITY, 1],
    ])
      expect(alertQuantity(input)).toBe(expected);
  });
});
