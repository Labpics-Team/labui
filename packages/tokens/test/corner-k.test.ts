import { describe, expect, it } from 'vitest';
import {
  deviationForN,
  deviationForNAtResolution,
  fitOptimalN,
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
