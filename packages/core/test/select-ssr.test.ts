import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/select/index.js';

const items = [
  { value: 'a', label: 'Первый' },
  { value: 'b', label: 'Второй' },
];

function label(markup: string): string {
  return markup.match(/part="value-text"[^>]*>(.*?)<\/span>/s)?.[1] ?? '';
}

describe('Select server selection', () => {
  it('renders property and attribute selections in the first frame', () => {
    const property = renderToString(
      html`<lab-select .items=${items} .value=${['b']}></lab-select>`,
    );
    const attribute = renderToString(
      html`<lab-select items=${JSON.stringify(items)} value='["b"]'></lab-select>`,
    );
    expect(label(property)).toContain('Второй');
    expect(label(attribute)).toContain('Второй');
  });

  it('uses defaultValue only when value is absent, preserving controlled empty selection', () => {
    const uncontrolled = renderToString(
      html`<lab-select .items=${items} .defaultValue=${['b', 'a']} multiple></lab-select>`,
    );
    const empty = renderToString(
      html`<lab-select .items=${items} .defaultValue=${['b']} .value=${[]} placeholder="Выбрать"></lab-select>`,
    );
    expect(uncontrolled.match(/class="lab-chip-label"[^>]*>(.*?)<\/span>/gs)?.join('')).toContain(
      'Второй',
    );
    expect(uncontrolled.match(/class="lab-chip-label"[^>]*>(.*?)<\/span>/gs)?.join('')).toContain(
      'Первый',
    );
    expect(label(empty)).toContain('Выбрать');
    expect(label(empty)).not.toContain('Второй');
  });
});
