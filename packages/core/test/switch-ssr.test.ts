import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/switch/index.js';

describe('Switch first server frame', () => {
  it('delivers the native value, validation, shape and both authored labels', () => {
    const output = renderToString(html`<lab-switch checked required name="alerts" value="yes" icon>
      <span slot="label-start">До</span>После</lab-switch>`);
    const input = output.match(/<input\b[^>]*>/)?.[0];
    expect(input).toContain('role="switch"');
    expect(input).toContain('checked');
    expect(input).toContain('required');
    expect(input).toContain('name="alerts"');
    expect(input).toContain('value="yes"');
    expect(output).toContain('mask-image: var(--_switch-cutout)');
    expect(output).toContain('До');
    expect(output).toContain('После');
    expect(output).not.toMatch(/class="lab-switch-label lab-switch-label-start"[^>]*hidden/);
  });
  it('renders default-checked before upgrade and omits the unchecked attribute', () => {
    const checked = renderToString(html`<lab-switch default-checked>Включён</lab-switch>`).match(
      /<input\b[^>]*>/,
    )?.[0];
    const unchecked = renderToString(html`<lab-switch>Выключен</lab-switch>`).match(
      /<input\b[^>]*>/,
    )?.[0];
    expect(checked).toMatch(/\schecked(?:\s|>)/);
    expect(unchecked).not.toMatch(/\schecked(?:[\s=>])/);
  });
  it('names an icon-only control before hydration without an empty label reference', () => {
    const output = renderToString(html`<lab-switch icon checked aria-label="Power"></lab-switch>`);
    const input = output.match(/<input\b[^>]*>/)?.[0];
    expect(input).toContain('aria-label="Power"');
    expect(input).not.toContain('aria-labelledby');
  });
});
