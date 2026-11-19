import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/progress/index.js';
import '../src/components/loader/index.js';

describe('progress server frame', () => {
  it('renders real range semantics, percent and reflected value without client state', () => {
    const output = renderToString(
      html`<lab-progress .value=${30} min="10" max="50" variant="circular" label="Импорт" show-value-text></lab-progress>`,
    );
    expect(output).toContain('shadowrootmode');
    expect(output).toContain('value="30"');
    expect(output).toContain('aria-valuenow="30"');
    expect(output).toContain('aria-valuemin="10"');
    expect(output).toContain('aria-valuemax="50"');
    expect(output).toContain('50%');
    expect(output).toContain('--_progress-target:0.5');
  });
  it('delivers a named unknown indicator with no value announcement', () => {
    for (const template of [
      html`<lab-progress show-value-text></lab-progress>`,
      html`<lab-loader label="Импорт"></lab-loader>`,
    ]) {
      const output = renderToString(template);
      expect(output).toContain('role="progressbar"');
      expect(output).not.toContain('aria-valuenow=');
      expect(output).not.toContain('aria-valuetext=');
    }
  });
  it('keeps zero distinct from unknown in the compact measured loader', () => {
    const output = renderToString(html`<lab-loader .value=${0}></lab-loader>`);
    expect(output).toContain('aria-valuenow="0"');
    expect(output).toContain('aria-valuetext="0%"');
  });
});
