import { afterEach, describe, expect, it, vi } from 'vitest';
import { materialMediaBlocked, prefersMoreContrast } from '../src/engine/preferences';

const element = {} as Element;

function environment(mode: string, queries: string[]) {
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => mode }));
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: queries.includes(query) }));
}

afterEach(() => vi.unstubAllGlobals());

describe('контраст области допускает живой материал независимо от OS-default', () => {
  it.each([
    ['normal', true, false],
    ['more', false, true],
    ['normal', false, false],
    ['more', true, true],
    ['', false, false],
    ['', true, true],
  ] as const)('%s при OS more=%s → more=%s', (mode, osMore, expected) => {
    environment(mode, osMore ? ['(prefers-contrast: more)'] : []);
    expect(prefersMoreContrast(element)).toBe(expected);
    expect(materialMediaBlocked(), 'OS more не запрещает все области разом').toBe(false);
  });

  it.each(['(prefers-reduced-transparency: reduce)', '(forced-colors: active)'])(
    'normal не отменяет системное ограничение %s',
    (query) => {
      environment('normal', [query]);
      expect(prefersMoreContrast(element)).toBe(false);
      expect(materialMediaBlocked()).toBe(true);
    },
  );

  it('смена разрешённой области перечитывается для уже смонтированной поверхности', () => {
    environment(' normal ', ['(prefers-contrast: more)']);
    expect(prefersMoreContrast(element)).toBe(false);
    environment(' more ', []);
    expect(prefersMoreContrast(element)).toBe(true);
  });

  it('повреждённая роль не подменяется настройкой ОС', () => {
    environment('normal more', []);
    expect(() => prefersMoreContrast(element)).toThrow('Неизвестный разрешённый режим контраста');
  });
});
