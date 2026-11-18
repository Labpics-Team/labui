import { describe, expect, it } from 'vitest';
import { LabElement } from '../src/lit/lab-element.js';
import { SSR_INPUTS_ATTRIBUTE } from '../src/lit/ssr-inputs.js';
import { html, renderToString } from '../src/ssr/index.js';

class InputsExample extends LabElement {
  static override properties = {
    enabled: { type: Boolean, reflect: true },
    items: { attribute: false, reflect: true },
    value: { attribute: false },
    internal: { state: true },
  };
  declare enabled: boolean;
  declare items: unknown[];
  declare value: unknown;
  declare internal: boolean;
  constructor() {
    super();
    this.enabled = true;
    this.items = ['default'];
    this.value = 'default';
    this.internal = false;
  }
  override render() {
    return html`<button ?disabled=${!this.enabled}>${String(this.value)}</button>`;
  }
}
customElements.define('lab-inputs-example', InputsExample);

describe('Server input ownership', () => {
  it('retains false, null and an empty property-only array', () => {
    const output = renderToString(
      html`<lab-inputs-example .enabled=${false} .value=${null} .items=${[]}></lab-inputs-example>`,
    );
    expect(output).toContain('data-lab-inputs=');
    const encoded = output.match(/data-lab-inputs="([^"]*)"/)?.[1];
    if (!encoded) throw new Error('Server inputs are missing');
    const initial = JSON.parse(encoded.replaceAll('&quot;', '"'));
    const client = new InputsExample();
    client.attributeChangedCallback(SSR_INPUTS_ATTRIBUTE, null, JSON.stringify(initial));
    expect(client.enabled).toBe(false);
    expect(client.items).toEqual([]);
    expect(client.value).toBe(null);
    expect(output).toMatch(/<button\b[^>]*\sdisabled/);
  });
  it('preserves defaults when the application omitted a property', () => {
    const output = renderToString(html`<lab-inputs-example></lab-inputs-example>`);
    expect(output).not.toContain('data-lab-inputs=');
    expect(output).not.toMatch(/<button\b[^>]*\sdisabled/);
  });
  it('restores only declared inputs and never replays initial data over live state', () => {
    const client = new InputsExample();
    client.attributeChangedCallback(
      SSR_INPUTS_ATTRIBUTE,
      null,
      '{"enabled":false,"internal":true,"innerHTML":"<script>bad</script>","__proto__":{}}',
    );
    expect(client.enabled).toBe(false);
    expect(client.internal).toBe(false);
    expect(Object.hasOwn(client, 'innerHTML')).toBe(false);
    client.enabled = true;
    client.attributeChangedCallback(SSR_INPUTS_ATTRIBUTE, null, '{"enabled":false}');
    expect(client.enabled).toBe(true);
  });
  it.each(['{', 'null', '[]'])('ignores malformed server data %s', (raw) => {
    const client = new InputsExample();
    client.attributeChangedCallback(SSR_INPUTS_ATTRIBUTE, null, raw);
    expect(client.enabled).toBe(true);
    expect(client.items).toEqual(['default']);
  });
  it('rejects opaque property input instead of silently dropping it from the server record', () => {
    expect(() =>
      renderToString(html`<lab-inputs-example .value=${() => 'callback'}></lab-inputs-example>`),
    ).toThrow('JSON-serializable');
  });
});
