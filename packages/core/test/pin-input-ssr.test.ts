import { expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/pin-input/index.js';

it('server paint preserves authored cells, defaults, mask and field semantics before hydration', () => {
  const output = renderToString(
    html`<lab-pin-input label="Код" default-value="12" mask count="4" required invalid error="Неверный код"></lab-pin-input>`,
  );
  expect(output).toContain('shadowrootmode');
  expect(output.match(/class="segment lab-pin-input-segment"/g)).toHaveLength(4);
  expect(output.match(/<input[^>]*type="password"/g)).toHaveLength(4);
  expect(output).toContain('value="1"');
  expect(output).toContain('value="2"');
  expect(output).toContain('aria-required="true"');
  expect(output).toContain('aria-errormessage=');
  expect(output).toContain('Неверный код');
  expect(output).toContain('--_pin-width: 3rem');
});
