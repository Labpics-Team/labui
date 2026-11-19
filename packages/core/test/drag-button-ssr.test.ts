import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/drag-button/index.js';

describe('Drag Button first server frame', () => {
  it('renders one named native action, authored helper and decorative artwork without JS', () => {
    const output = renderToString(html`<lab-drag-button label="Send transfer"></lab-drag-button>`);
    expect(output.match(/<button\b/g)).toHaveLength(1);
    expect(output).toContain('aria-label="Send transfer"');
    expect(output).toContain('Swipe it');
    expect(output).toContain('<svg');
    expect(output).toContain('data-status="idle"');
    expect(output).not.toContain('role="slider"');
  });
  it('retains a completed result before hydration with no misleading idle frame', () => {
    const output = renderToString(
      html`<lab-drag-button label="Send" status="danger" danger-text="Could not send"></lab-drag-button>`,
    );
    expect(output).toContain('data-status="danger"');
    expect(output).toContain('aria-disabled="true"');
    expect(output).toContain('Could not send');
    expect(output).toContain('<output');
    expect(output).toContain('aria-live="polite"');
  });
});
