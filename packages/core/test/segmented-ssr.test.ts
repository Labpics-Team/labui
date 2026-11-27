import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/segmented-control/index.js';

const items = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя', disabled: true },
  { value: 'month', label: 'Месяц' },
];
describe('Segmented first server frame', () => {
  it('renders real radios, one tab stop, selection and disabled before JavaScript', () => {
    const output = renderToString(
      html`<lab-segmented-control name="period" label="Период" required default-value="month" .items=${items}></lab-segmented-control>`,
    );
    const inputs = output.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(3);
    expect(inputs.filter((input) => /\schecked(?:[\s>])/.test(input))).toEqual([inputs[2]]);
    expect(inputs.filter((input) => input.includes('tabindex="0"'))).toEqual([inputs[2]]);
    expect(inputs[1]).toMatch(/\sdisabled(?:[\s>])/);
    expect(output).toContain('role="radiogroup"');
    expect(output).not.toContain('role="tab"');
  });
  it('preserves deliberate empty controlled selection and an entry point', () => {
    const output = renderToString(
      html`<lab-segmented-control .value=${null} default-value="day" .items=${items}></lab-segmented-control>`,
    );
    const inputs = output.match(/<input\b[^>]*>/g) ?? [];
    expect(inputs.every((input) => !/\schecked(?:[\s>])/.test(input))).toBe(true);
    expect(inputs[0]).toContain('tabindex="0"');
    expect(output).toContain('data-controlled');
  });
  it('rejects malformed or duplicated serialized models as a whole', () => {
    for (const data of [
      '{bad',
      '[{"value":"a","label":"A"},{"value":"a","label":"B"}]',
      '[{"value":"a","label":"A","disabled":"false"}]',
    ]) {
      expect(
        renderToString(html`<lab-segmented-control items=${data}></lab-segmented-control>`),
      ).not.toContain('<input');
    }
  });
});
