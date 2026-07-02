import { describe, expect, it } from 'vitest';
import { classifyLabVar, concentricRadius, litConcentricRadius } from '../src/css.js';

/**
 * Закон концентрического радиуса (docs/dimension-contract.md §3):
 *
 *   radius_inner = max(radius_outer − inset, MIN)
 *
 * `concentricRadius` — единственная исполняемая форма закона; компоненты
 * потребляют её, а не копируют числа. Набор запирает ОБА слоя:
 *   - класс А (юнит): эмитируемое CSS-выражение — в точности закон;
 *   - класс Б (характеризация): числовое зеркало формулы воспроизводит
 *     деривируемую верхнюю половину лестницы Figma Radius (20/24/28/32 =
 *     нижняя ступень + Padding), так что «мелкая правка» формулы, тихо
 *     меняющая геометрию, падает здесь первой.
 */

/** Числовое зеркало CSS-выражения — характеризация закона в px. */
function concentricPx(outerPx: number, insetPx: number, minPx = 2): number {
  return Math.max(outerPx - insetPx, minPx);
}

describe('concentricRadius — emitted CSS (class A)', () => {
  it('emits max(calc((outer) - (inset)), var(--lab-radius-concentric-min, 0.125rem))', () => {
    expect(concentricRadius('var(--_radius)', 'var(--_pad)')).toBe(
      'max(calc((var(--_radius)) - (var(--_pad))), var(--lab-radius-concentric-min, 0.125rem))',
    );
  });

  it('parenthesizes compound operands (a compound inset must not flip its sign)', () => {
    expect(concentricRadius('1rem', '1px + 1px')).toContain('calc((1rem) - (1px + 1px))');
  });

  it('the floor rides the semantic token with a canonical 2px (=0.125rem) fallback', () => {
    // Токен обязан классифицироваться как размерный (компонент вправе его
    // читать), а литерал фолбэка — равняться канону --lab-radius-xs, на который
    // алиасится concentric-min; гард no-magic-dimension держит то же равенство
    // по всем мигрированным компонентам.
    expect(classifyLabVar('--lab-radius-concentric-min')).toBe('dimension');
    expect(concentricRadius('0', '0')).toContain('var(--lab-radius-concentric-min, 0.125rem)');
  });

  it('litConcentricRadius emits the identical expression for Lit templates', () => {
    expect(String(litConcentricRadius('var(--_r)', 'var(--_i)'))).toBe(
      concentricRadius('var(--_r)', 'var(--_i)'),
    );
  });
});

describe('concentric law — numeric characterization (class B)', () => {
  it('maps the upper half of the Figma Radius ladder onto lower steps through the law', () => {
    // Живая Figma «🟠 1.1 Dimention»: Radius = 0,2,4,6,8,12,16,20,24,28,32,Full;
    // Padding S=4 / M=8 (заземлено 2026-07-02, figma-console). Каждая ступень
    // выше 16 = нижняя ступень + ступень Padding — лестница есть замыкание
    // закона, а не список независимых констант. Деривация внутрь:
    expect(concentricPx(20, 4)).toBe(16); // Figma Radius/2XL − Padding/S → Radius/XL (=labui card)
    expect(concentricPx(24, 8)).toBe(16); // Figma Radius/3XL − Padding/M → Radius/XL
    expect(concentricPx(28, 4)).toBe(24); // Figma Radius/4XL − Padding/S → Radius/3XL
    expect(concentricPx(32, 8)).toBe(24); // Figma Radius/5XL − Padding/M → Radius/3XL
    expect(concentricPx(16, 8)).toBe(8); // Figma Radius/XL − Padding/M → Radius/M (=labui control)
  });

  it('floors at the minimum instead of going square or negative', () => {
    expect(concentricPx(4, 8)).toBe(2); // отступ глубже внешнего радиуса
    expect(concentricPx(2, 2)).toBe(2); // ровно на полу
    expect(concentricPx(0, 16)).toBe(2); // вырожденный внешний
  });

  it('is monotonic in the outer radius and anti-monotonic in the inset', () => {
    for (let outer = 2; outer <= 32; outer += 2) {
      expect(concentricPx(outer + 2, 4)).toBeGreaterThanOrEqual(concentricPx(outer, 4));
      expect(concentricPx(outer, 6)).toBeLessThanOrEqual(concentricPx(outer, 4));
    }
  });
});
