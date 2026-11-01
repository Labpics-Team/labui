import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type EngineBinding, mountEngine } from '../src/engine/mount';

// Модель только discovery и порядка sync. Настоящие handles, стили и observers
// проверяет material-runtime-lifetime.spec.ts через публичный runtime в браузере.
class Surface {
  isConnected = true;
  material = 'glass';
  veil = true;
  effect = '';
  tier = 'base';
  renderedTier = '';

  matches(selector: string): boolean {
    return selector === '.lab-material' || (selector === '[data-veil]' && this.veil);
  }

  querySelectorAll(): Surface[] {
    return [];
  }
}

const element = (surface: Surface): HTMLElement => surface as unknown as HTMLElement;
const scope = (...surfaces: Surface[]): Document =>
  ({
    querySelectorAll: (selector: string) => surfaces.filter((s) => s.matches(selector)),
  }) as unknown as Document;

function engine(mode: string): EngineBinding & { attach: ReturnType<typeof vi.fn> } {
  return {
    gate: () => true,
    selector: mode === 'veil' ? '[data-veil]' : '.lab-material',
    wants: (el) => mode === 'veil' || (el as unknown as Surface).material === mode,
    refreshHeld: true,
    attach: vi.fn((el: HTMLElement) => {
      const surface = el as unknown as Surface;
      if (mode !== 'veil') surface.effect = mode;
      return {
        refresh: vi.fn(() => {
          surface.renderedTier = surface.tier;
        }),
        destroy: vi.fn(() => {
          // Реальные glass/acrylic очищают общий inline backdrop-filter.
          if (mode !== 'veil') surface.effect = '';
        }),
      };
    }),
  };
}

describe('владение эффектом при пересекающихся scope', () => {
  beforeEach(() => vi.stubGlobal('HTMLElement', Surface));
  afterEach(() => vi.unstubAllGlobals());

  it.each(['app-first', 'surface-first'])('%s: один attach до последнего release', (order) => {
    const a = new Surface();
    const b = new Surface();
    const binding = engine('glass');
    const app = mountEngine(binding, scope(a, b));
    const child = mountEngine(binding, element(a));
    const sibling = mountEngine(binding, element(b));
    const mounts = order === 'app-first' ? [app, child, sibling] : [child, sibling, app];
    for (const mounted of mounts) mounted.sync();
    expect(binding.attach).toHaveBeenCalledTimes(2);
    const handles = binding.attach.mock.results.map((result) => result.value);

    mounts[0]?.dispose();
    expect(handles.every((handle) => handle.destroy.mock.calls.length === 0)).toBe(true);
    for (const mounted of mounts.slice(1)) mounted.dispose();
    expect(handles.every((handle) => handle.destroy.mock.calls.length === 1)).toBe(true);
  });

  it.each([
    ['glass', 'acrylic'],
    ['acrylic', 'glass'],
  ])('%s → %s: поздний sync/dispose не стирает новый эффект', (from, to) => {
    const surface = new Surface();
    surface.material = from;
    const previous = engine(from);
    const next = engine(to);
    const veil = engine('veil');
    const oldApp = mountEngine(previous, scope(surface));
    const oldChild = mountEngine(previous, element(surface));
    const newChild = mountEngine(next, element(surface));
    const independent = mountEngine(veil, element(surface));
    oldApp.sync();
    oldChild.sync();
    independent.sync();
    const formerHandle = previous.attach.mock.results[0]?.value;
    const veilHandle = veil.attach.mock.results[0]?.value;

    surface.material = to;
    newChild.sync(); // Новый binding опережает старые observers.
    expect(formerHandle.destroy).toHaveBeenCalledTimes(1);
    expect(surface.effect).toBe(to);
    expect(veilHandle.destroy).not.toHaveBeenCalled();
    oldApp.sync();
    oldChild.dispose();
    expect(surface.effect).toBe(to);
    expect(formerHandle.destroy).toHaveBeenCalledTimes(1);

    oldApp.dispose();
    newChild.dispose();
    independent.dispose();
  });

  it('смена tier обновляет общий handle; media отзывает его у всех прежних mount', () => {
    const surface = new Surface();
    const binding = engine('glass');
    let blocked = false;
    binding.blocked = () => blocked;
    const app = mountEngine(binding, scope(surface));
    const child = mountEngine(binding, element(surface));
    app.sync();
    child.sync();
    const formerHandle = binding.attach.mock.results[0]?.value;
    surface.tier = 'soft';
    child.sync();
    expect(surface.renderedTier).toBe('soft');
    expect(binding.attach).toHaveBeenCalledTimes(1);

    blocked = true;
    child.sync();
    expect(formerHandle.destroy).toHaveBeenCalledTimes(1);
    expect(surface.effect).toBe('');
    blocked = false;
    child.sync();
    app.dispose(); // Прежний hold не владеет новым поколением.
    expect(surface.effect).toBe('glass');
    child.dispose();
  });

  it('отсоединённый root не reacquire; reconnect создаёт новое поколение', () => {
    const surface = new Surface();
    const binding = engine('glass');
    const app = mountEngine(binding, scope(surface));
    const child = mountEngine(binding, element(surface));
    app.sync();
    child.sync();
    surface.isConnected = false;
    child.sync();
    child.sync();
    expect(binding.attach).toHaveBeenCalledTimes(1);
    expect(surface.effect).toBe('');
    surface.isConnected = true;
    child.sync();
    expect(binding.attach).toHaveBeenCalledTimes(2);
    app.dispose();
    expect(surface.effect).toBe('glass');
    child.dispose();
  });

  it('dispose терминален: queued sync не возвращает ресурсы и не трогает преемника', () => {
    const surface = new Surface();
    const binding = engine('glass');
    const old = mountEngine(binding, element(surface));
    old.sync();
    old.dispose();
    const current = mountEngine(binding, element(surface));
    current.sync();
    old.sync();
    old.dispose();
    expect(binding.attach).toHaveBeenCalledTimes(2);
    expect(surface.effect).toBe('glass');
    current.dispose();
    expect(surface.effect).toBe('');
  });

  it('reconnect через app сохраняет live lease локального root без его собственного sync', () => {
    const surface = new Surface();
    const binding = engine('glass');
    const app = mountEngine(binding, scope(surface));
    const child = mountEngine(binding, element(surface));
    app.sync();
    child.sync();
    surface.isConnected = false;
    app.sync();
    expect(surface.effect).toBe('');
    surface.isConnected = true;
    app.sync();
    app.dispose();
    expect(surface.effect).toBe('glass');
    child.dispose();
    expect(surface.effect).toBe('');
  });
});
