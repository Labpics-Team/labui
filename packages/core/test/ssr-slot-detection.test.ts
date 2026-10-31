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
});
