/**
 * SSR-смоук по ВСЕМ render-функциям с пустыми пропами: каждый `renderX({})`
 * обязан отрендерить declarative shadow DOM, а не упасть. Ловит два класса
 * регрессий разом: чтение `machineCtl.api` в render() до старта машины и
 * клоббер массивных дефолтов `setProperty(name, undefined)` из SSR-обёрток
 * (`.prop=${props.x}` при отсутствующем `x`). Ручные тройки button/input/dialog
 * в ssr.test.ts это не ловили — падали как раз некурируемые компоненты.
 */
import { describe, expect, it } from 'vitest';
import * as ssr from '../src/ssr.js';

const renderFns = Object.entries(ssr).filter(
  (entry): entry is [string, (props: object) => string] =>
    entry[0].startsWith('render') && typeof entry[1] === 'function',
);

describe('SSR: every component renders DSD from empty props', () => {
  it('the barrel exposes the full component set', () => {
    expect(renderFns.length).toBeGreaterThanOrEqual(27);
  });

  for (const [name, fn] of renderFns) {
    it(`${name}({}) renders declarative shadow DOM`, () => {
      const out = fn({});
      expect(out).toContain('shadowrootmode');
    });
  }

  it('renderProgress renders the SSR value text without the machine', () => {
    expect(ssr.renderProgress({ showValueText: true, value: 40 })).toContain('shadowrootmode');
  });
});
