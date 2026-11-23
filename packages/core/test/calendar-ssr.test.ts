import { expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/calendar/index.js';

it('server-renders a real date-only month with selection and today independent', () => {
  const output = renderToString(
    html`<lab-calendar default-month="2024-02-01" today="2024-02-20" .defaultValue=${['2024-02-29']} locale="en-US"></lab-calendar>`,
  );
  expect(output).toContain('shadowrootmode');
  expect(output).toContain('February 2024');
  expect(output).toContain('Thursday, February 29, 2024');
  expect(output.match(/class="lab-calendar-day"/g)).toHaveLength(42);
  expect(output).toContain('aria-current="date"');
  expect(output).toContain('data-active');
});

it('serializes unavailable dates and localized event templates without a callback', () => {
  const output = renderToString(html`<lab-calendar today="2024-02-20" default-month="2024-02-01"
    .unavailableDates=${['2024-02-28']} .events=${{ '2024-02-29': 7 }} .translations=${{ events: 'Событий: {count}' }}></lab-calendar>`);
  expect(output).toContain('Событий: 7');
  expect(output).toContain('unavailableDates');
  expect(output).toMatch(/data-date="2024-02-28"[^>]*aria-disabled="true"/);
  expect(() =>
    renderToString(html`<lab-calendar .isDateUnavailable=${() => true}></lab-calendar>`),
  ).toThrow('not a JSON-serializable SSR input');
});
