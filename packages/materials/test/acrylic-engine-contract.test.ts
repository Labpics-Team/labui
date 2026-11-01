/*
 * Acrylic-движок ↔ material.css / acrylic-corridor — кросс-файловые замки
 * дрейфа (паттерн engine-css-contract.test.ts). Примитивы SVG-фильтра — это
 * атрибуты (var() недоступен), поэтому числа конвейера живут литералами в
 * engine/acrylic.ts; эти пины гарантируют, что ЛЮБОЕ расхождение с токенами
 * листа или с математикой коридора краснит CI, а не тихо расщепляет рецепт.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';
import { ACRYLIC_LUMINOSITY_OPACITY } from '../src/acrylic-corridor';
import {
  ACRYLIC_BLUR_PX,
  ACRYLIC_ENGINE_MEDIA,
  ACRYLIC_REACH_PX,
  ACRYLIC_SATURATE,
  attach,
} from '../src/engine/acrylic';
import { mountEngine } from '../src/engine/mount';
import { MATERIAL_TIERS } from '../src/material-guarantee';

const here = dirname(fileURLToPath(import.meta.url));
const css = readMaterialCss();
const engineSrc = readFileSync(join(here, '../src/engine/acrylic.ts'), 'utf8');
const runtimeSrc = readFileSync(join(here, '../src/engine/runtime.ts'), 'utf8');
const mountSrc = readFileSync(join(here, '../src/engine/mount.ts'), 'utf8');

describe('конвейер повторяет ступени листа (один рычаг, не две копии значения)', () => {
  it('ACRYLIC_BLUR_PX === --_blur-live из material.css', () => {
    const m = css.match(/--_blur-live:\s*(\d+(?:\.\d+)?)px/);
    expect(m, 'material.css must declare --_blur-live').not.toBeNull();
    expect(Number(m?.[1])).toBe(ACRYLIC_BLUR_PX);
  });

  it('ACRYLIC_SATURATE === --_saturate-on из material.css', () => {
    const m = css.match(/--_saturate-on:\s*(\d+(?:\.\d+)?)%/);
    expect(m, 'material.css must declare --_saturate-on').not.toBeNull();
    expect(Number(m?.[1]) / 100).toBeCloseTo(ACRYLIC_SATURATE, 10);
  });

  it('flood-opacity конвейера — ровно константа вывода коридора', () => {
    expect(engineSrc).toContain(
      "flood.setAttribute('flood-opacity', String(ACRYLIC_LUMINOSITY_OPACITY))",
    );
    // Значение Λ — замок: смена ручки = осознанная правка здесь + пересчёт
    // голдена гарантированных пар (acrylic-corridor.test.ts).
    expect(ACRYLIC_LUMINOSITY_OPACITY).toBe(0.7);
  });

  it('flood-color — живой var() контрактного тинта tier (никакого своего цвета)', () => {
    expect(engineSrc).toContain('`var(--lab-bg-material-${tier}-01)`');
    // Дефолтный tier CSS-оси и дефолт tierOf() обязаны совпадать.
    expect(MATERIAL_TIERS).toContain('base');
    expect(engineSrc).toContain("return 'base'");
  });

  it('пространство счёта закреплено: color-interpolation-filters="sRGB"', () => {
    expect(engineSrc).toContain("filter.setAttribute('color-interpolation-filters', 'sRGB')");
  });

  it('смесь — luminosity, flood поверх насыщенного блюра (in=f, in2=s)', () => {
    expect(engineSrc).toContain("blend.setAttribute('mode', 'luminosity')");
    expect(engineSrc).toContain("blend.setAttribute('in', 'f')");
    expect(engineSrc).toContain("blend.setAttribute('in2', 's')");
  });
});

// Модель проверяет владение DOM-узлами и исходным document. Разрешение url()
// и наследование вычисленных цветов проверяются реальным браузером.
class FilterNode {
  children: FilterNode[] = [];
  parentNode: FilterNode | null = null;
  attributes = new Map<string, string>();
  values = new Map<string, string>();
  priorities = new Map<string, string>();
  isConnected = true;
  offsetWidth = 160;
  offsetHeight = 80;
  classList = { contains: () => false };
  style = {
    cssText: '',
    setProperty: (key: string, value: string, priority = '') => {
      this.values.set(key, value);
      this.priorities.set(key, priority);
    },
    getPropertyValue: (key: string) => this.values.get(key) ?? '',
    getPropertyPriority: (key: string) => this.priorities.get(key) ?? '',
  };

  constructor(
    readonly tag: string,
    readonly ownerDocument: FilterDocument,
  ) {}

  setAttribute(key: string, value: string): void {
    this.attributes.set(key, value);
  }

  appendChild(node: FilterNode): FilterNode {
    node.remove();
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  append(...nodes: FilterNode[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  remove(): void {
    if (this.parentNode)
      this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }

  matches(selector: string): boolean {
    return selector === '.lab-material';
  }

  querySelectorAll(): FilterNode[] {
    return [];
  }

  find(tag: string): FilterNode | undefined {
    if (this.tag === tag) return this;
    for (const child of this.children) {
      const found = child.find(tag);
      if (found) return found;
    }
  }
}

class FilterDocument {
  body = new FilterNode('body', this);
  createElementNS(_namespace: string, tag: string): FilterNode {
    return new FilterNode(tag, this);
  }
}

describe('фильтр принадлежит поверхности и её локальному контексту', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('attach размещает всю SVG-цепочку внутри surface в её ownerDocument', () => {
    const ambient = new FilterDocument();
    const owner = new FilterDocument();
    const surface = new FilterNode('article', owner);
    vi.stubGlobal('document', ambient);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
    const handle = attach(surface as unknown as HTMLElement);
    try {
      const filter = surface.find('filter');
      expect(
        filter,
        'фильтр должен иметь тот же tree scope и CSS-предков, что поверхность',
      ).toBeDefined();
      expect(surface.find('feFlood')?.ownerDocument).toBe(owner);
      expect(ambient.body.children).toHaveLength(0);
    } finally {
      handle.destroy();
    }
    expect(surface.children).toHaveLength(0);
  });

  it('destroy удаляет только собственный SVG; повторный attach и сосед не теряются', () => {
    const owner = new FilterDocument();
    vi.stubGlobal('document', owner);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
    const first = new FilterNode('article', owner);
    const second = new FilterNode('article', owner);
    first.style.setProperty('backdrop-filter', 'blur(2px)', 'important');
    const old = attach(first as unknown as HTMLElement);
    const neighbor = attach(second as unknown as HTMLElement);
    const current = attach(first as unknown as HTMLElement);
    try {
      old.destroy();
      expect(first.children).toHaveLength(1);
      expect(second.find('filter')).toBeDefined();
      current.destroy();
      current.destroy();
      expect(first.children).toHaveLength(0);
      expect(first.style.getPropertyValue('backdrop-filter')).toBe('blur(2px)');
      expect(first.style.getPropertyPriority('backdrop-filter')).toBe('important');
      expect(second.find('filter')).toBeDefined();
    } finally {
      current.destroy();
      neighbor.destroy();
    }
    expect(second.children).toHaveLength(0);
  });

  it('sync после замены контента возвращает тот же фильтр, сохраняя новый контент и handle', () => {
    const owner = new FilterDocument();
    vi.stubGlobal('document', owner);
    vi.stubGlobal('HTMLElement', FilterNode);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
    const surface = new FilterNode('article', owner);
    const attachSpy = vi.fn(attach);
    const mounted = mountEngine(
      {
        gate: () => true,
        selector: '.lab-material',
        wants: () => true,
        refreshHeld: true,
        attach: attachSpy,
      },
      surface as unknown as HTMLElement,
    );
    mounted.sync();
    const filter = surface.find('filter');
    const svg = surface.find('svg');
    expect(filter).toBeDefined();
    svg?.remove();
    const content = new FilterNode('span', owner);
    surface.appendChild(content);
    try {
      mounted.sync();
      mounted.sync();
      expect(
        surface.find('filter') === filter,
        'тот же фильтр возвращается без нового attach',
      ).toBe(true);
      expect(surface.children.length).toBe(2);
      expect(surface.children[0] === content && surface.children[1] === svg).toBe(true);
      expect(attachSpy).toHaveBeenCalledTimes(1);
    } finally {
      mounted.dispose();
    }
    mounted.sync();
    attachSpy.mock.results[0]?.value.restore?.();
    expect(surface.children.length).toBe(1);
    expect(surface.children[0] === content).toBe(true);
  });
});

describe('честные деградации: движок гаснет во всех медиа-режимах листа', () => {
  it('каждый запрещающий @media листа есть в ACRYLIC_ENGINE_MEDIA', () => {
    // Класс: «новая деградация добавлена в лист, движок о ней не знает» —
    // инлайн пережил бы её. Все transparency/contrast/forced-медиа листа
    // обязаны быть перечислены движку.
    const sheetMedia = [
      '(prefers-reduced-transparency: reduce)',
      '(prefers-contrast: more)',
      '(forced-colors: active)',
    ];
    for (const query of sheetMedia) {
      expect(css, `material.css должен нести деградацию ${query}`).toContain(`@media ${query}`);
      expect(ACRYLIC_ENGINE_MEDIA, `движок должен гаснуть под ${query}`).toContain(query);
    }
  });

  it('binding acrylic несёт blocked=acrylicMediaBlocked + mediaQueries, рантайм слушает их change', () => {
    // Смысл замка (не строка): acrylic-движок гаснет под запрещающими медиа
    // (blocked отзывает ресурс в mountEngine) И их смена ре-синкает mount.
    expect(runtimeSrc).toContain('blocked: acrylicMediaBlocked');
    expect(runtimeSrc).toContain('mediaQueries: ACRYLIC_ENGINE_MEDIA');
    expect(runtimeSrc).toContain("mq.addEventListener('change', schedule)");
    // blocked() запрещает attach/refresh; логические leases сохраняются.
    expect(mountSrc).toContain('if (!binding.blocked?.())');
  });
});

describe('родной LG-стиль региона (userSpaceOnUse, изотропный охват — ADR-0009 v2.1)', () => {
  it('фильтр userSpaceOnUse по боксу элемента (как линза liquid-glass), не objectBoundingBox', () => {
    expect(engineSrc).toContain("filter.setAttribute('filterUnits', 'userSpaceOnUse')");
  });

  it('охват = 2σ (95% энергии гаусса, компромисс перф/качество), изотропный, из бокса', () => {
    expect(ACRYLIC_REACH_PX).toBe(2 * ACRYLIC_BLUR_PX);
    expect(engineSrc).toContain('el.offsetWidth + 2 * m');
    expect(engineSrc).toContain('el.offsetHeight + 2 * m');
  });

  it('прежний процентный регион снесён без следа (класс-дефект виньетки короткой оси)', () => {
    // objectBoundingBox −25%/150% давал РАЗНЫЙ охват по осям → недобор блюра
    // по короткой оси вытянутых поверхностей. Возврат = осознанная правка.
    expect(engineSrc).not.toContain("'-25%'");
    expect(engineSrc).not.toContain("'150%'");
  });

  it('фильтр сохраняет uid и registry поверхности', () => {
    expect(engineSrc).toContain('lab-acrylic-${++uid}');
    expect(engineSrc).toContain('registry.set(el, handle)');
  });
});

describe('гейт и скоуп', () => {
  it('гейт — общая capability-проба mount, НЕ импорт из glass-модуля (acrylic ⊥ glass)', () => {
    // Анатомия разная (диффузия+зажим vs рефракция+линза), общего эффекта нет.
    // Общая только браузерная СПОСОБНОСТЬ рисовать url()-фильтр на backdrop.
    expect(engineSrc).toContain('return supportsBackdropFilterUrl()');
    expect(engineSrc).not.toContain("from './liquid-glass'");
  });

  it('рантайм читает эффективный CSS-режим, включая slot-наследование и деградации', () => {
    expect(runtimeSrc).toContain("wants: (el) => inModeScope(el, 'acrylic')");
    expect(runtimeSrc).toContain("getPropertyValue('--_material-mode')");
    expect(runtimeSrc).not.toContain("closest('[data-material]')");
  });
});
