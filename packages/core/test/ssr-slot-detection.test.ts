/**
 * Регресс на SSR-безопасность `hasDefaultSlotContent` (LabElement).
 *
 * Класс бага: под @lit-labs/ssr у инстанса нет обходимого light-DOM, `this.childNodes`
 * не итерируется — элемент, чей `render()` зовёт `hasDefaultSlotContent` (button /
 * checkbox / switch), падал бы. Гард возвращает под SSR `true`. Этот тест бетонирует
 * класс: SSR таких элементов НЕ бросает и эмитит declarative shadow DOM.
 *
 * Этот тест проверяет render-путь исходников. Cold import собранных package
 * exports отдельно проверяется в adapter-codegen/test/ssr-entry.test.ts.
 * Node-экспорты Lit дают общий customElements registry; импорты компонентов
 * регистрируют используемые здесь элементы без отдельного DOM preload.
 */
import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/button/index.js';
import '../src/components/checkbox/index.js';
import '../src/components/switch/index.js';

describe('SSR: hasDefaultSlotContent не падает под @lit-labs/ssr', () => {
  it('button с контентом слота рендерится в DSD', () => {
    const out = renderToString(html`<lab-button type="accent">Сохранить</lab-button>`);
    expect(out).toContain('shadowrootmode');
    expect(out).toContain('Сохранить');
  });

  it('button без контента слота (icon-only-путь) не бросает и даёт DSD', () => {
    const out = renderToString(html`<lab-button type="accent"></lab-button>`);
    expect(out).toContain('shadowrootmode');
  });

  it('checkbox и switch (тоже зовут hasDefaultSlotContent) рендерятся в DSD', () => {
    expect(renderToString(html`<lab-checkbox></lab-checkbox>`)).toContain('shadowrootmode');
    expect(renderToString(html`<lab-switch></lab-switch>`)).toContain('shadowrootmode');
  });

  it('Switch сохраняет defaultChecked в SSR, а явный checked=false имеет приоритет', () => {
    const defaultOn = renderToString(html`<lab-switch default-checked></lab-switch>`);
    expect(defaultOn).toMatch(/class="root"\s+data-state="checked"/);
    expect(defaultOn).toMatch(/<input\s+type="checkbox"\s+checked/);
    const explicitOff = renderToString(
      html`<lab-switch .defaultChecked=${true} .checked=${false}></lab-switch>`,
    );
    expect(explicitOff).toMatch(/class="root"\s+data-state="unchecked"/);
    expect(explicitOff).not.toMatch(/<input\s+type="checkbox"\s+checked/);
  });
});
