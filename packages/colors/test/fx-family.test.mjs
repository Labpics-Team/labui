// FX-семья паспорта labui: полнота сентиментов, прогрессия glow, WCAG-пол
// focus-ring, алиас skeleton. Гейт КУСАЕТСЯ (RED-first доказан): без
// success/info в glow+focus-ring и без ступеней subtle/bloom тест краснеет.
//
// Класс А (contract/unit на ЖИВОМ движке) + Б (полнота набора как регрессия).
// Провенанс каждого значения — эмиссия опубликованного @labpics/colors на
// паспорте, а не литерал в тесте.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import passport from '../labui.config.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));

// Обязательный набор сентиментов FX-семьи (канон LabUI-таксономия §FX):
// нейтраль + бренд + 4 сентимента. Отсутствие любого = красный.
const SENTIMENTS = ['neutral', 'brand', 'danger', 'warning', 'success', 'info'];
// Реальные источники прогрессивного свечения (inverted — не свечение, а
// translucent-ladder по дизайну, вне набора ступеней).
const GLOW_STEPS = ['subtle', 'base', 'bloom'];

/** Имена ролей паспорта (recipe-роли, без алиасов). */
function roleNames() {
  return new Set(passport.roles.map((r) => r.name));
}

/** Имя glow-роли для сентимента и ступени: base — без суффикса. */
function glowRole(sentiment, step) {
  return step === 'base' ? `fx-glow-${sentiment}` : `fx-glow-${sentiment}-${step}`;
}

describe('FX-семья: полнота сентиментов glow и focus-ring', () => {
  it('glow перечисляет ВСЕ 6 сентиментов (падает при отсутствии любого)', () => {
    const names = roleNames();
    const missing = SENTIMENTS.filter((s) => !names.has(`fx-glow-${s}`));
    expect(missing, 'сентименты без glow-роли').toEqual([]);
  });

  it('focus-ring перечисляет ВСЕ 6 сентиментов (падает при отсутствии любого)', () => {
    const names = roleNames();
    const missing = SENTIMENTS.filter((s) => !names.has(`fx-focus-ring-${s}`));
    expect(missing, 'сентименты без focus-ring-роли').toEqual([]);
  });

  it('glow прогрессивен: каждый сентимент несёт 3 ступени GlowStep', () => {
    const names = roleNames();
    const missing = [];
    for (const s of SENTIMENTS) {
      for (const step of GLOW_STEPS) {
        const role = glowRole(s, step);
        if (!names.has(role)) missing.push(role);
      }
    }
    expect(missing, 'отсутствующие ступени glow').toEqual([]);
  });
});

describe('FX-семья: инварианты на живом движке', () => {
  /** @type {{colors: any}} */
  let engine;
  /** @type {Record<string, any>} */
  let darkRoles;

  beforeAll(async () => {
    engine = await createLabuiEngine();
    // Тёмная тема: screen-свечение физически горит (в светлой над белым гаснет,
    // α→0 — деградация солвера), потому монотонность мерим на dark.
    darkRoles = engine.colors.resolveTheme(passport.neutral.anchors.dark, 'dark').roles;
  });

  it('монотонность интенсивности слоёв: subtle < base < bloom (α, dark)', () => {
    for (const s of SENTIMENTS) {
      const a = darkRoles[glowRole(s, 'subtle')];
      const b = darkRoles[glowRole(s, 'base')];
      const c = darkRoles[glowRole(s, 'bloom')];
      expect(a?.kind, `${s}: subtle не glow`).toBe('glow');
      expect(b?.kind, `${s}: base не glow`).toBe('glow');
      expect(c?.kind, `${s}: bloom не glow`).toBe('glow');
      expect(a.alpha, `${s}: subtle<base`).toBeLessThan(b.alpha);
      expect(b.alpha, `${s}: base<bloom`).toBeLessThan(c.alpha);
    }
  });

  it('focus-ring не ослабляет WCAG-пол: композит ≥ 3:1 (AA UI) для всех сентиментов', () => {
    // Доступность по построению: focus-appearance (WCAG 2.4.13) — не-текстовый
    // контур, пол AA UI 3:1. Роль резолвится на нейтральном фоне темы; движок
    // возвращает compositeWcag непрозрачного штриха.
    for (const s of SENTIMENTS) {
      const r = darkRoles[`fx-focus-ring-${s}`];
      expect(r, `${s}: focus-ring не эмитится`).toBeTruthy();
      const wcag = r.compositeWcag ?? r.contrastWcag;
      expect(wcag, `${s}: focus-ring WCAG=${wcag} < 3:1`).toBeGreaterThanOrEqual(3.0);
    }
  });
});

describe('FX-семья: алиас skeleton', () => {
  it('fx-skeleton-base = алиас на fill Tertiary/Quaternary', () => {
    const alias = passport.aliases.find((a) => a.alias === 'fx-skeleton-base');
    expect(alias, 'алиас fx-skeleton-base отсутствует').toBeTruthy();
    expect(['fill-tertiary', 'fill-quaternary']).toContain(alias.target);
  });
});
