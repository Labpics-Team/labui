import { describe, expect, it } from 'vitest';
import {
  type ParityRow,
  accentDrift,
  accentParity,
  accentTokens,
  setsEqual,
} from './accent-twin-parity.js';

/**
 * Гейт парности акцентной роли ядро (Lit) ↔ React-близнец (ADR-0001).
 *
 * Волна 6 «консистентность акцентной роли»: акцент обязан читаться ОДИНАКОВО в
 * обоих рукописных слоях. До гейта ничто статически не удерживало это — правка
 * `react/button.css` без зеркала в `core/…/lab-button.ts` (или наоборот) прошла
 * бы CI молча, и близнецы разошлись бы. Playwright `button-vue-parity` проверяет
 * лишь Vue в рантайме на одном компоненте; этот гейт — статический, по всему
 * корпусу, специфично на акцентном семействе.
 *
 * Суита и валит регрессию на живом дереве (сверка множеств), и доказывает, что
 * детектор реально КУСАЕТСЯ на подложенном дрейфе — зелёный прогон значит
 * «парно», а не «слепо».
 */
describe('парность акцентной роли: ядро (Lit) ↔ React-близнец', () => {
  it('перечисляет содержательную поверхность акцентных компонентов', () => {
    // Заземление сессии: 13 компонентов читают акцентные роли (accordion,
    // breadcrumb, button, checkbox, combobox, menu, pagination, progress,
    // radio-group, select, slider, switch, tabs). Пол (>=10) валит массовую
    // потерю чтений без пиннинга churn-склонного точного числа.
    const rows = accentParity();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.map((r) => r.name)).toContain('button');
    // button — эталон: полное акцентное семейство в обоих слоях.
    const button = rows.find((r) => r.name === 'button') as ParityRow;
    expect([...button.core].sort()).toEqual([
      '--lab-border-accent',
      '--lab-fill-accent',
      '--lab-fill-accent-tinted',
      '--lab-label-accent',
      '--lab-label-on-accent',
    ]);
  });

  it('каждый компонент с React-близнецом читает ТОЖДЕСТВЕННОЕ акцентное множество', () => {
    const drift = accentDrift();
    const report = drift
      .map(
        (r) =>
          `  ${r.name}: ядро={${[...r.core].sort().join(', ')}}  React={${[...r.react].sort().join(', ')}}`,
      )
      .join('\n');
    expect(
      drift,
      `компоненты, где акцентные чтения ядра и React-близнеца расходятся (привести оба слоя к одной роли):\n${report}`,
    ).toEqual([]);
  });

  it('каждый акцентный компонент имеет React-близнец (нет одностороннего слоя)', () => {
    const orphans = accentParity().filter((r) => !r.hasReactTwin);
    expect(
      orphans,
      `акцентные компоненты ядра без React-близнеца (близнец отстал):\n${orphans.map((r) => `  ${r.name}`).join('\n')}`,
    ).toEqual([]);
  });

  // ── Детекция-пруф: сверка обязана ПРОВАЛИТЬСЯ на подложенном дрейфе ─────────
  // «Подложи расхождение → гейт падает» как постоянный позитивный тест, чтобы
  // детекция не сгнила молча.
  it('setsEqual ловит расхождение множеств (RED-proof)', () => {
    expect(setsEqual(new Set(['--lab-fill-accent']), new Set(['--lab-fill-accent']))).toBe(true);
    // React-близнец «сполз» с роли на сырой бренд-токен — множества разошлись.
    expect(
      setsEqual(new Set(['--lab-fill-accent']), new Set(['--lab-fill-brand-primary'])),
      'дрейф роль→сырой токен обязан детектироваться',
    ).toBe(false);
    // Пропавшее чтение (близнец потерял border-accent) — тоже расхождение.
    expect(
      setsEqual(
        new Set(['--lab-fill-accent', '--lab-border-accent']),
        new Set(['--lab-fill-accent']),
      ),
    ).toBe(false);
  });

  it('извлекает реальное потребление, игнорирует прозу (litVar/var, не комментарий)', () => {
    // Ядро: реальный litVar считается; упоминание в комментарии — нет.
    const core = [
      '/** header reads `--lab-label-accent` on hover (проза, не потребление) */',
      "background-color: ${litVar('--lab-fill-accent')};",
      "color: ${litVar('--lab-label-on-accent')};",
    ].join('\n');
    expect([...accentTokens(core, true)].sort()).toEqual([
      '--lab-fill-accent',
      '--lab-label-on-accent',
    ]);
    // React: var() в CSS считается; в блок-комментарии — нет.
    const react = [
      '/* пример: var(--lab-fill-accent-tinted) */',
      'color: var(--lab-label-accent);',
    ].join('\n');
    expect([...accentTokens(react, false)]).toEqual(['--lab-label-accent']);
  });
});
