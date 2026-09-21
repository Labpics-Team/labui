import { describe, expect, it } from 'vitest';
import {
  deviationForN,
  deviationForNAtResolution,
  fitOptimalN,
  maxDeviation,
} from '../scripts/derive-corner-k.mjs';
import { defaultConfig } from '../src/config/default-config.js';

/**
 * Замок деривации cornerK (ревью labui#74): скрипт derive-corner-k.mjs —
 * воспроизводимый провенанс, но сам по себе ручной; этот тест связывает
 * зафиксированный `defaultConfig.radii.cornerK` с фактической математикой,
 * превращая DECLARED-комментарий в проверяемый инвариант. Падает, если:
 * - кто-то меняет ZETA/R/конструкцию кривой в скрипте, не пересчитав
 *   задокументированные отклонения в RadiiConfig.cornerK;
 * - кто-то меняет cornerK в конфиге, не обновив классификацию.
 *
 * Числа — из деривации 2026-07-03 (симметричный Хаусдорф, R=100, ζ=0.6):
 * круг K=1 → 1.249px; K=1.1 → 2.348px; геометрический оптимум n*≈2.0.
 */
describe('cornerK — замок деривации против дрейфа', () => {
  it('spatial-grid oracle byte-for-byte сохраняет brute-force метрику на малом witness', () => {
    const a: Array<[number, number]> = [[-3, 0], [-2, 0.2], [-1, 0.8], [0, 2]];
    const b: Array<[number, number]> = [[-3, 0], [-2.4, 0.1], [-1.3, 0.6], [-0.4, 1.4], [0, 2]];
    const brute = (A: Array<[number, number]>, B: Array<[number, number]>) => {
      let worst = 0;
      for (const [ax, ay] of A) {
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i + 1 < B.length; i++) {
          const [x1, y1] = B[i];
          const [x2, y2] = B[i + 1];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len2 = dx * dx + dy * dy;
          let t = len2 === 0 ? 0 : ((ax - x1) * dx + (ay - y1) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const ddx = ax - (x1 + t * dx);
          const ddy = ay - (y1 + t * dy);
          best = Math.min(best, ddx * ddx + ddy * ddy);
        }
        worst = Math.max(worst, best);
      }
      return Math.sqrt(worst);
    };
    expect(maxDeviation(a, b)).toBe(brute(a, b));
    expect(maxDeviation(b, a)).toBe(brute(b, a));
    const zigzag: Array<[number, number]> = [[0, 0], [2, 1], [1, 2], [3, 3]];
    expect(maxDeviation(a, zigzag)).toBe(brute(a, zigzag));
  });

  it('конфиг несёт задокументированное DECLARED-значение', () => {
    expect(defaultConfig.radii.cornerK).toBe(1.1);
  });

  it('отклонение конфигового K от кривой Figma ζ=0.6 — в задокументированном коридоре', () => {
    const dev = deviationForN(2 ** defaultConfig.radii.cornerK);
    expect(dev).toBeGreaterThan(2.2);
    expect(dev).toBeLessThan(2.5);
  });

  it('круг остаётся геометрически ближе, чем K=1.1 — честная классификация «размен, не фит»', () => {
    const circle = deviationForN(2);
    expect(circle).toBeGreaterThan(1.1);
    expect(circle).toBeLessThan(1.4);
    expect(circle).toBeLessThan(deviationForN(2 ** defaultConfig.radii.cornerK));
  });

  it('bounded derivation grid converges against a 2× denser witness', () => {
    const bounded = deviationForN(2);
    const denser = deviationForNAtResolution(2, 600, 1500);
    expect(Math.abs(bounded - denser)).toBeLessThan(0.001);
  });

  it(
    'геометрический оптимум — у круга (n* ≈ 2), не у конфигового K',
    // Bounded grid имеет отдельный convergence witness выше; длинный таймаут
    // больше не нужен, поэтому регрессия к квадратичному многоминутному oracle
    // снова станет обычным test failure.
    { timeout: 10_000 },
    () => {
      expect(fitOptimalN()).toBeLessThan(2.02);
    },
  );
});
