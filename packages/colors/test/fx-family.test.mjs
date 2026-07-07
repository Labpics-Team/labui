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

/** Имена алиасов паспорта (флаг наследования: alias→target). */
function aliasNames() {
  return new Set((passport.aliases ?? []).map((a) => a.alias));
}

// EC4: цвет focus-ring НЕ эмитится независимо — он НАСЛЕДУЕТ сильный штрих
// семьи Label соответствующего сентимента (label-{sentiment}-primary) через
// явный флаг наследования alias→target. label-primary — самый контрастный
// уровень (text-anchor, floor aa-text, WCAG ~17–20:1), потому focus-appearance
// (WCAG 2.4.13) гарантирован по построению, а не эмиссией отдельного акцента,
// который на светлой теме проваливал 3:1 (warning/success были ~2.0–2.2).
const FOCUS_LABEL_TARGET = {
  neutral: 'label-primary',
  brand: 'label-brand-primary',
  danger: 'label-danger-primary',
  warning: 'label-warning-primary',
  success: 'label-success-primary',
  info: 'label-info-primary',
};

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

  it('focus-ring перечисляет ВСЕ 6 сентиментов (алиасы наследования)', () => {
    const names = aliasNames();
    const missing = SENTIMENTS.filter((s) => !names.has(`fx-focus-ring-${s}`));
    expect(missing, 'сентименты без focus-ring-алиаса').toEqual([]);
  });

  it('focus-ring наследует сильный штрих Label (EC4): alias→label-{sentiment}-primary', () => {
    const byAlias = new Map((passport.aliases ?? []).map((a) => [a.alias, a.target]));
    for (const s of SENTIMENTS) {
      expect(byAlias.get(`fx-focus-ring-${s}`), `${s}: focus-ring не алиас на label-strong`).toBe(
        FOCUS_LABEL_TARGET[s],
      );
    }
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

  // WCAG-пол focus-ring (≥3:1, WCAG 2.4.13) проверяется на ОБЕИХ темах в
  // блоке «focus-ring НАСЛЕДУЕТ label-strong (EC4)» ниже — после перехода на
  // наследование алиас-роль несёт wcagRatio (не compositeWcag), и новый гейт
  // покрывает light+dark строго; дублировать здесь single-theme нельзя.
});

// EC4 контракт-гейт (класс А, живой движок): резолвнутый цвет focus-ring
// БАЙТ-РАВЕН резолвнутому label-{sentiment}-strong на КАЖДОЙ теме. Гейт
// КУСАЕТСЯ: если источник focus-ring переключить обратно на независимую
// ladder-эмиссию акцента (или на не-label рампу), css/hex разойдутся и тест
// покраснеет (RED-proof — см. probe: ladder focus-ring давал oklch(60% ...),
// label-primary даёт oklch(9.9% ...)). Геометрия кольца (ширина/CSS) — вне
// цветовой деривации, тут не проверяется (North EC4: геометрия отделена).
describe('FX-семья: focus-ring НАСЛЕДУЕТ label-strong (EC4, байт-равенство)', () => {
  /** @type {{colors: any}} */
  let engine;
  beforeAll(async () => {
    engine = await createLabuiEngine();
  });

  for (const mode of ['light', 'dark']) {
    it(`focus-ring цвет == label-{sentiment}-strong для всех 6 сентиментов (${mode})`, () => {
      const anchors = passport.neutral.anchors[mode];
      const roles = engine.colors.resolveTheme(anchors, mode).roles;
      for (const s of SENTIMENTS) {
        const focus = roles[`fx-focus-ring-${s}`];
        const label = roles[FOCUS_LABEL_TARGET[s]];
        expect(focus, `${mode}/${s}: focus-ring не резолвится`).toBeTruthy();
        expect(label, `${mode}/${s}: label-strong не резолвится`).toBeTruthy();
        // Цвет байт-равен: css + hex (алиас копирует значение target, только
        // cssVar именуется --lab-fx-focus-ring-<s> — это и есть наследование).
        expect(focus.css, `${mode}/${s}: css focus != label`).toBe(label.css);
        expect(focus.hex ?? focus.compositeHex, `${mode}/${s}: hex focus != label`).toBe(
          label.hex ?? label.compositeHex,
        );
      }
    });
  }

  it('focus-ring не ослабляет WCAG-пол: наследованный контраст ≥ 3:1 (AA UI, обе темы)', () => {
    for (const mode of ['light', 'dark']) {
      const roles = engine.colors.resolveTheme(passport.neutral.anchors[mode], mode).roles;
      for (const s of SENTIMENTS) {
        const r = roles[`fx-focus-ring-${s}`];
        const wcag = r.wcagRatio ?? r.compositeWcag ?? r.contrastWcag;
        expect(wcag, `${mode}/${s}: focus WCAG=${wcag} < 3:1`).toBeGreaterThanOrEqual(3.0);
      }
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

// Пропагация в ОПУБЛИКОВАННЫЙ контракт (contract.css + roles.json) — тот класс
// бага, что паспортная правка не доходила до артефакта: generate-contract.mjs
// хардкодил glow на 4 легаси-сентимента (base only) и не эмитил focus-ring
// success/info. Гейт КУСАЕТСЯ на до-фикс генераторе (18 glow + 6 focus-ring
// отсутствуют в контракте, монотонность subtle<base<bloom невыразима — alpha
// ступеней нет). Провенанс значений — живая эмиссия @labpics/colors, не литерал.
describe('FX-семья: пропагация в опубликованный контракт', () => {
  const stubDir = join(here, '..', '..', 'colors-stub');
  /** @type {string} */
  let contractCss;
  /** @type {{ groups: Record<string, string[]> }} */
  let rolesJson;
  /** @type {string} */
  let darkBody;

  beforeAll(async () => {
    contractCss = await readFile(join(stubDir, 'contract.css'), 'utf8');
    rolesJson = JSON.parse(await readFile(join(stubDir, 'roles.json'), 'utf8'));
    darkBody = scopeBody(contractCss, '[data-theme="dark"]');
  });

  /** Тело top-level scope по началу селектора (сбалансированные скобки). */
  function scopeBody(css, selector) {
    const start = css.indexOf(selector);
    if (start === -1) throw new Error(`scope не найден: ${selector}`);
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
    }
    throw new Error(`несбалансированные скобки: ${selector}`);
  }

  /** Объявлена ли роль (в позиции декларации) в данном теле. */
  function declares(body, role) {
    const re = new RegExp(`(^|[;{\\s])${role.replace(/[-]/g, '\\-')}\\s*:`, 'm');
    return re.test(body);
  }

  /** Полный набор glow-color-ролей: 6 сентиментов × 3 ступени (base без суффикса). */
  const GLOW_COLOR_ROLES = SENTIMENTS.flatMap((s) =>
    GLOW_STEPS.map((step) => `--lab-fx-glow-${step === 'base' ? s : `${s}-${step}`}`),
  );
  const FOCUS_ROLES = SENTIMENTS.map((s) => `--lab-fx-focus-ring-${s}`);

  it('contract.css объявляет glow base/subtle/bloom × 6 сентиментов (18)', () => {
    const missing = GLOW_COLOR_ROLES.filter((r) => !declares(contractCss, r));
    expect(missing, 'glow-роли, не дошедшие до contract.css').toEqual([]);
  });

  it('contract.css объявляет focus-ring × 6 сентиментов', () => {
    const missing = FOCUS_ROLES.filter((r) => !declares(contractCss, r));
    expect(missing, 'focus-ring-роли, не дошедшие до contract.css').toEqual([]);
  });

  it('roles.json (FX-группа) перечисляет 18 glow + 6 focus-ring', () => {
    const fx = new Set(rolesJson.groups.FX ?? []);
    const missing = [...GLOW_COLOR_ROLES, ...FOCUS_ROLES].filter((r) => !fx.has(r));
    expect(missing, 'FX-роли, не занесённые в roles.json').toEqual([]);
  });

  it('монотонность в dark: subtle-α < base-α < bloom-α на каждый сентимент', () => {
    const alphaOf = (role) => {
      const m = new RegExp(`${role.replace(/[-]/g, '\\-')}\\s*:\\s*([0-9.]+)\\s*;`).exec(darkBody);
      return m ? Number.parseFloat(m[1]) : Number.NaN;
    };
    for (const s of SENTIMENTS) {
      const sub = alphaOf(`--lab-fx-glow-${s}-subtle-alpha`);
      const base = alphaOf(`--lab-fx-glow-${s}-alpha`);
      const bloom = alphaOf(`--lab-fx-glow-${s}-bloom-alpha`);
      expect(sub, `${s}: subtle-α не число`).not.toBeNaN();
      expect(base, `${s}: base-α не число`).not.toBeNaN();
      expect(bloom, `${s}: bloom-α не число`).not.toBeNaN();
      expect(sub, `${s}: subtle<base`).toBeLessThan(base);
      expect(base, `${s}: base<bloom`).toBeLessThan(bloom);
    }
  });
});
