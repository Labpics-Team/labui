import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/sheet/index.js';

describe('Sheet SSR', () => {
  it('доставляет trigger и content slot в закрытом popover без клиентского floating DOM', () => {
    const output = renderToString(html`
      <lab-sheet position="half" heading="Настройки">
        Открыть
        <form slot="content"><input name="name" value="Исходный ввод" /></form>
      </lab-sheet>
    `);
    expect(output).toContain('shadowrootmode="open"');
    expect(output).toContain('class="trigger"');
    expect(output).toContain('class="portal-plane" popover="manual"');
    expect(output).toMatch(/<slot name="content" slot="content"/);
    expect(output).toContain('Исходный ввод');
    expect(output).not.toContain('class="positioner"');
    expect(output).not.toContain('data-lab-sheet-portal');
  });

  it('open не заставляет сервер создавать floating DOM', () => {
    const output = renderToString(html`<lab-sheet .open=${true}>Открыть</lab-sheet>`);
    expect(output).toContain('class="trigger"');
    expect(output).not.toContain('class="content lab-material');
  });
});
