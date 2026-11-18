import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/checkbox/index.js';
import '../src/components/radio-group/index.js';
import '../src/components/choicebox/index.js';

describe('selection first server frame', () => {
  it('serializes native checkbox values and mixed accessibility without false boolean attributes', () => {
    const off = renderToString(html`<lab-checkbox name="item">Нет</lab-checkbox>`).match(
      /<input\b[^>]*>/,
    )?.[0];
    expect(off).not.toMatch(/\schecked(?:[\s=>])/);
    const on = renderToString(
      html`<lab-checkbox default-checked required name="item" value="yes">Да</lab-checkbox>`,
    ).match(/<input\b[^>]*>/)?.[0];
    expect(on).toMatch(/\schecked(?:\s|>)/);
    expect(on).toContain('required');
    expect(on).toContain('value="yes"');
    const mixed = renderToString(html`<lab-checkbox default-indeterminate>Часть</lab-checkbox>`);
    expect(mixed).toContain('aria-checked="mixed"');
    expect(mixed.match(/<input\b[^>]*>/)?.[0]).not.toMatch(/\schecked(?:[\s=>])/);
  });
  it('serializes radio names, value, disabled options and accessible labels before hydration', () => {
    const output = renderToString(
      html`<lab-radio-group name="plan" label="План" required default-value="b" items='[{"value":"a","label":"Первый","disabled":true},{"value":"b","label":"Второй"}]'></lab-radio-group>`,
    );
    const inputs = output.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toContain('disabled');
    expect(inputs[0]).not.toMatch(/\schecked(?:[\s=>])/);
    expect(inputs[1]).toMatch(/\schecked(?:\s|>)/);
    expect(inputs[1]).toContain('name="plan"');
    expect(output).toContain('role="radiogroup"');
    expect(output).toContain('Второй');
  });
  it('composes one actual Check or Radio per Choicebox option in DSD', () => {
    for (const multiple of [false, true]) {
      const output = renderToString(
        html`<lab-choicebox ?multiple=${multiple} default-value='["a"]' items='[{"value":"a","label":"Первый"},{"value":"b","label":"Второй"}]'></lab-choicebox>`,
      );
      const inputs = output.match(/<input\b[^>]*>/g) ?? [];
      expect(inputs).toHaveLength(2);
      expect(inputs.filter((input) => /\schecked(?:\s|>)/.test(input))).toHaveLength(1);
      expect(
        inputs.every((input) => input.includes(`type="${multiple ? 'checkbox' : 'radio'}"`)),
      ).toBe(true);
      expect(output).toContain('data-variant="card"');
    }
  });
});
