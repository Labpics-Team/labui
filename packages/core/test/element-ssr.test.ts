import { html } from 'lit';
import { describe, expect, it } from 'vitest';
import { renderElementParts } from '../src/ssr/element.js';
import '../src/components/textarea/index.js';
import { LabElement } from '../src/lit/lab-element.js';

class FrameworkSsrExample extends LabElement {
  static override properties = {
    label: {},
    enabled: { type: Boolean, reflect: true },
    model: { attribute: false },
  };
  declare label: string;
  declare enabled: boolean;
  declare model: unknown;
  constructor() {
    super();
    this.label = 'Default';
    this.enabled = true;
    this.model = ['default'];
  }
  override render() {
    return html`<button aria-label=${this.getAttribute('aria-label') ?? this.label}
      data-form=${this.getAttribute('form') ?? ''} data-id=${this.getAttribute('id') ?? ''}
      ?disabled=${!this.enabled}>${JSON.stringify(this.model)}<slot></slot></button>`;
  }
}
customElements.define('lab-framework-ssr-example', FrameworkSsrExample);
const specs = [
  { name: 'label', attr: 'label', kind: 'string' },
  { name: 'enabled', attr: 'enabled', kind: 'boolean' },
  { name: 'model', attr: 'model', kind: 'prop' },
] as const;

describe('framework element SSR boundary', () => {
  it('renders only the element-owned shadow and exposes native attributes before render', () => {
    const result = renderElementParts('lab-framework-ssr-example', {
      specs,
      props: { label: null, enabled: false, model: null },
      attributes: {
        id: 'example',
        form: 'checkout',
        'aria-label': 'Read & edit',
        'aria-hidden': false,
        hidden: false,
        class: ['framework', { owns: true }],
        style: { color: 'red' },
        onClick: () => undefined,
      },
    });
    expect(result?.attributes).toMatchObject({
      id: 'example',
      form: 'checkout',
      'aria-label': 'Read & edit',
      'aria-hidden': 'false',
    });
    expect(result?.attributes).not.toHaveProperty('label');
    expect(result?.attributes).not.toHaveProperty('hidden');
    expect(result?.attributes).not.toHaveProperty('class');
    expect(result?.attributes).not.toHaveProperty('style');
    expect(result?.attributes).not.toHaveProperty('onclick');
    expect(JSON.parse(result?.attributes['data-lab-inputs'] ?? '{}')).toEqual({
      enabled: false,
      model: null,
    });
    expect(result?.shadowHtml).toMatch(/^<template shadowrootmode="open"/);
    expect(result?.shadowHtml).not.toContain('<lab-framework-ssr-example');
    expect(result?.shadowRoot?.contents).toContain('aria-label="Read &amp; edit"');
    expect(result?.shadowRoot?.contents).toContain('data-form="checkout"');
    expect(result?.shadowRoot?.contents).toContain('data-id="example"');
  });

  it('keeps omitted constructor inputs and explicit empty models distinct', () => {
    const omitted = renderElementParts('lab-framework-ssr-example', { specs, props: {} });
    const empty = renderElementParts('lab-framework-ssr-example', { specs, props: { model: [] } });
    expect(omitted?.shadowHtml).toContain('[&quot;default&quot;]');
    expect(omitted?.attributes).not.toHaveProperty('data-lab-inputs');
    expect(empty?.shadowHtml).not.toContain('[&quot;default&quot;]');
    expect(JSON.parse(empty?.attributes['data-lab-inputs'] ?? '{}')).toEqual({ model: [] });
  });

  it('uses the same Textarea specialization as full-template SSR', () => {
    const result = renderElementParts('lab-textarea', {
      specs: [{ name: 'value', attr: 'value', kind: 'prop' }],
      props: { value: '\nServer <draft>' },
    });
    expect(result?.shadowHtml).toMatch(/<textarea[^>]*>\n\nServer &lt;draft&gt;<\/textarea>/);
  });
});
