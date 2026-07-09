import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trailingRaf } from '../src/engine/mount';

/*
 * Общий движковый примитив (./mount) — юнит trailing-rAF без DOM (mock rAF).
 * ensureHiddenDefs / mountEngine — DOM-механика; их поведение проверяет
 * реальный браузер (apps/docs/tests/acrylic-live.spec.ts гоняет весь путь
 * runtime → mountEngine → acrylic attach/detach/refresh), а source-контракт —
 * acrylic-engine-contract.test.ts. Здесь — чистая логика сворачивания,
 * которую копировали все три движка и теперь несёт один примитив.
 */

describe('trailingRaf — сворачивание шторма в один кадр', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;

  beforeEach(() => {
    frames = new Map();
    nextId = 1;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      const id = nextId++;
      frames.set(id, cb);
      return id;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number): void => {
      frames.delete(id);
    }) as typeof cancelAnimationFrame;
  });

  const flush = (): void => {
    const run = [...frames.values()];
    frames.clear();
    for (const cb of run) cb(0);
  };

  it('N вызовов schedule = ОДИН rAF и один запуск fn', () => {
    const fn = vi.fn();
    const raf = trailingRaf(fn);
    raf.schedule();
    raf.schedule();
    raf.schedule();
    expect(frames.size, 'один отложенный кадр, не три').toBe(1);
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('после кадра schedule снова планирует (не залипает)', () => {
    const fn = vi.fn();
    const raf = trailingRaf(fn);
    raf.schedule();
    flush();
    raf.schedule();
    flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel снимает отложенный кадр — fn не запускается', () => {
    const fn = vi.fn();
    const raf = trailingRaf(fn);
    raf.schedule();
    raf.cancel();
    flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel без отложенного кадра безвреден (идемпотентен)', () => {
    const fn = vi.fn();
    const raf = trailingRaf(fn);
    expect(() => {
      raf.cancel();
      raf.cancel();
    }).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});
