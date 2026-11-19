import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/badge/index.js';

describe('Badge first server frame', () => {
  it('delivers authored paint, label and both icon slots before registration', () => {
    const output = renderToString(
      html`<lab-badge color="yellow" type="fill">Badge<svg slot="icon"></svg><svg slot="icon-end"></svg></lab-badge>`,
    );
    expect(output).toContain('data-color="yellow"');
    expect(output).toContain('--lab-badge-label-on-yellow');
    expect(output).toContain('name="icon"');
    expect(output).toContain('name="icon-end"');
    expect(output).not.toMatch(/role="button"|tabindex=|<button/);
    expect(output).toContain('Badge');
  });
  it('normalizes the legacy color spelling before hydration', () => {
    const output = renderToString(html`<lab-badge color="warning" disabled>Badge</lab-badge>`);
    expect(output).toContain('data-color="orange"');
    expect(output).toContain('data-disabled="true"');
  });
});
