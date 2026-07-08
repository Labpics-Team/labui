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
import { skeletonHighlightCss } from '../generate-contract.mjs';
import passport from '../labui.config.json' with { type: 'json' };
import { degam, hexToLin, oklabOf } from '../oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// ─── Перцептивные утилиты (oklab) для законов glow/skeleton ───
/** Хью (град, 0–360) и хрома цвета из hex через ту же Oklab-математику движка. */
function hueChroma(hex) {
  const [, a, b] = oklabOf(hexToLin(hex));
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { hue, chroma: Math.hypot(a, b) };
}
/** Кратчайшая дуга между двумя хью (град, 0–180). */
function hueDist(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}
/** Светлота oklab композита translucent-оверлея (tint,α) над surface — БЛЕНД В
 * sRGB(гамма)-пространстве, как CSS-alpha и движок (линейный блендинг соврал бы). */
function compositeOklabL(tintHex, alpha, surfaceHex) {
  const srgb = (h) => {
    const n = Number.parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const o = srgb(tintHex);
  const s = srgb(surfaceHex);
  const blend = o.map((c, i) => (c * alpha + s[i] * (1 - alpha)) / 255);
  return oklabOf(blend.map(degam))[0];
}
/** Разобрать tint-hex и α из translucent-oklch движка/контракта. */
function parseTranslucent(role) {
  const tint = role.tintHex ?? role.hex ?? role.compositeHex;
  return { tint, alpha: role.alpha };
}

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

describe('FX-семья: skeleton — база ушла в Fill, шиммер остался в FX', () => {
  // Решение владельца (#100): поверхность-заглушка — это Fill (существующая
  // ступень fill-лестницы), а FX-словарь строго тени/свечения. fx-skeleton-base
  // снесён полностью (потребителей 0), база адресуется fill-quaternary напрямую;
  // шиммер fx-skeleton-highlight остаётся в FX как случай осветления (glow-кейс).
  it('fx-skeleton-base снесён из паспорта — база скелетона есть fill-quaternary', () => {
    const alias = passport.aliases.find((a) => a.alias === 'fx-skeleton-base');
    expect(alias, 'fx-skeleton-base ещё жив в passport.aliases').toBeUndefined();
    expect(
      passport.roles.some((r) => r.name === 'fill-quaternary'),
      'fill-quaternary — существующая ступень fill-лестницы, адресует базу',
    ).toBe(true);
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

  // #100: база-заглушка — Fill (fill-quaternary), FX держит только шиммер.
  it('contract.css: fx-skeleton-base снесён, шиммер fx-skeleton-highlight остался', () => {
    expect(
      declares(contractCss, '--lab-fx-skeleton-base'),
      'fx-skeleton-base ещё объявлен в contract.css — база должна быть fill-quaternary',
    ).toBe(false);
    expect(
      declares(contractCss, '--lab-fx-skeleton-highlight'),
      'шиммер fx-skeleton-highlight пропал из FX-контракта',
    ).toBe(true);
  });

  it('roles.json (FX-группа): fx-skeleton-base снят, fx-skeleton-highlight есть', () => {
    const fx = new Set(rolesJson.groups.FX ?? []);
    expect(fx.has('--lab-fx-skeleton-base'), 'fx-skeleton-base ещё в roles.json FX').toBe(false);
    expect(fx.has('--lab-fx-skeleton-highlight'), 'шиммер снят из roles.json FX').toBe(true);
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

// Прогрессия glow — ЗАКОН, а не три ручных множителя на сентимент. Провенанс:
// поле achievedDj движка — ДОСТИГНУТЫЙ перцептивный |ΔJ'| свечения над фоном
// (солвер бисектит α под фикс. целью ступени). Тесты доказывают, что цель
// ступени ОБЩАЯ для всех 6 сентиментов (одна лестница), а не набор per-сентимент.
describe("FX-семья: glow-прогрессия — ЗАКОН фиксированного |ΔJ'| на ступень (dark)", () => {
  /** @type {Record<string, any>} */
  let darkRoles;
  beforeAll(async () => {
    const e = await createLabuiEngine();
    // Монотонность/лестницу мерим на dark: в light screen над белым гаснет
    // (achievedDj=0, degraded) — там |ΔJ'| невыразим.
    darkRoles = e.colors.resolveTheme(passport.neutral.anchors.dark, 'dark').roles;
  });

  const djOf = (s, step) => darkRoles[glowRole(s, step)].achievedDj;
  const band = (step) => {
    const v = SENTIMENTS.map((s) => djOf(s, step));
    return { min: Math.min(...v), max: Math.max(...v), spread: Math.max(...v) - Math.min(...v) };
  };

  it('цель ступени ОБЩАЯ для всех сентиментов: полосы achievedDj попарно ДИЗЪЮНКТНЫ', () => {
    // Будь ступени per-сентимент множителями — base одного сентимента мог бы
    // попасть в диапазон subtle другого. Непересечение полос доказывает ОДНУ
    // разделяемую лестницу целей (закон), а не 6 независимых настроек.
    const sub = band('subtle');
    const ba = band('base');
    const bl = band('bloom');
    expect(sub.max, `subtle-полоса [${sub.min},${sub.max}] пересекает base`).toBeLessThan(ba.min);
    expect(ba.max, `base-полоса [${ba.min},${ba.max}] пересекает bloom`).toBeLessThan(bl.min);
  });

  it("лестница — ФИКСИРОВАННЫЙ |ΔJ'| на ступень, а НЕ фиксированное ОТНОШЕНИЕ", () => {
    // Подпись «фикс. цель + абсолютный допуск солвера»: разброс внутри полосы
    // почти ПОСТОЯНЕН по ступеням, хотя цель растёт ~1→2.5→13. Закон
    // «фикс. отношение» дал бы spread(bloom) ≈ (bloom/subtle ≈ 13×) × spread(subtle)
    // — отношение разбросов > 3. Фактор < 3 решительно отвергает эту гипотезу.
    const spreads = GLOW_STEPS.map((st) => band(st).spread);
    const ratio = Math.max(...spreads) / Math.min(...spreads);
    expect(
      ratio,
      `разброс масштабируется с величиной (fixed-ratio): spreads=${spreads}`,
    ).toBeLessThan(3);
  });

  it('воспроизводимость: повторная загрузка движка даёт БИТ-идентичный achievedDj', async () => {
    const e2 = await createLabuiEngine();
    const r2 = e2.colors.resolveTheme(passport.neutral.anchors.dark, 'dark').roles;
    for (const s of SENTIMENTS) {
      for (const st of GLOW_STEPS) {
        expect(r2[glowRole(s, st)].achievedDj, `${s}/${st} не детерминирован`).toBe(djOf(s, st));
      }
    }
  });
});

// ХРОМАТИЧЕСКАЯ идентичность (задача владельца: success/info не должны
// деградировать в серое/чужую семью; info легитимно делит хью с брендом).
// Инвариант: halo glow каждого ЦВЕТНОГО сентимента приземляется в СВОЮ семью
// палитры и держит хрому. Провенанс ожидаемого хью — якорь семьи из паспорта
// (sentiments.categories → palette), не литерал в тесте.
describe('FX-семья: glow несёт хроматическую идентичность сентимента (success/info)', () => {
  const COLORED = ['brand', 'danger', 'warning', 'success', 'info'];
  // Семья сентимента → ключ палитры (brand — отдельный якорь бренда).
  const FAMILY_KEY = Object.fromEntries(
    passport.sentiments.categories.map((c) => [c.name, c.family]),
  );
  /** hex-якорь семьи сентимента для темы (brand/palette). */
  function familyAnchor(sentiment, theme) {
    if (sentiment === 'brand') return passport.brand[theme];
    const key = FAMILY_KEY[sentiment];
    return passport.palette.find((p) => p.key === key).anchors[theme];
  }

  for (const theme of ['light', 'dark']) {
    it(`halo каждого цветного glow держит хрому и приземляется в СВОЮ семью (${theme})`, async () => {
      const e = await createLabuiEngine();
      const roles = e.colors.resolveTheme(passport.neutral.anchors[theme], theme).roles;
      // Набор якорей всех семей — для проверки «ближайшая семья = своя».
      const anchors = COLORED.map((s) => ({ s, ...hueChroma(familyAnchor(s, theme)) }));
      for (const s of COLORED) {
        const halo = roles[`fx-glow-${s}`].haloHex;
        const { hue, chroma } = hueChroma(halo);
        const own = anchors.find((a) => a.s === s);
        // (1) Хрома не сдулась в серое: ≥ 40% хромы якоря семьи (заземление, не литерал).
        expect(
          chroma,
          `${theme}/${s}: halo обесцветился (chroma=${chroma.toFixed(3)})`,
        ).toBeGreaterThan(0.4 * own.chroma);
        // (2) Ближайшая по хью семья — СВОЯ (параметр-free классификация). Отделяет
        // success(зелёный) от info(синий) от danger(красный) по построению.
        const nearest = anchors.reduce((best, a) =>
          hueDist(hue, a.hue) < hueDist(hue, best.hue) ? a : best,
        );
        expect(
          nearest.s,
          `${theme}/${s}: halo(${hue.toFixed(0)}°) ближе к семье ${nearest.s}`,
        ).toBe(s);
      }
    });
  }
});

// Шиммер скелетона — ЗАКОН осветления (см. generate-contract.mjs). Инвариант:
// highlight перцептивно СВЕТЛЕЕ base в ОБЕИХ темах. Гейт КУСАЕТСЯ: старое
// Figma-значение highlight (mid@0.039) в dark ТЕМНЕЕ base — RED-доказательство ниже.
describe('FX-семья: шиммер скелетона светлее base в обеих темах (закон осветления)', () => {
  /** @type {any} */
  let engine;
  beforeAll(async () => {
    engine = await createLabuiEngine();
  });

  it('чистый закон skeletonHighlightCss: белый (L=100% C=0) при α base', () => {
    const out = skeletonHighlightCss('oklch(57.53363% 0.012136 286.012 / 0.161)');
    expect(out).toBe('oklch(100.00000% 0.000000 286.012 / 0.161)');
    // Хью сохранён из base (родословная), α посимвольно равна base (байт-стабильность).
    expect(out).toMatch(/ 286\.012 \/ 0\.161\)$/);
  });

  for (const theme of ['light', 'dark']) {
    it(`highlight композитится СВЕТЛЕЕ base над фоном темы (${theme})`, () => {
      const bg = passport.neutral.anchors[theme];
      const roles = engine.colors.resolveTheme(bg, theme).roles;
      // База скелетона — fill-quaternary (шиммер деривируется от неё, #100).
      const base = parseTranslucent(roles['fill-quaternary']);
      // highlight по закону = белый при α base.
      const WHITE = passport.neutral.anchors.light;
      const baseL = compositeOklabL(base.tint, base.alpha, bg);
      const hlL = compositeOklabL(WHITE, base.alpha, bg);
      expect(
        hlL,
        `${theme}: highlight(${hlL.toFixed(4)}) ≤ base(${baseL.toFixed(4)})`,
      ).toBeGreaterThan(baseL);
    });
  }

  it('RED-доказательство: СТАРЫЙ Figma-highlight (mid@0.039) в dark ТЕМНЕЕ base', () => {
    // Гарантия, что тест реально кусается: до-законное значение нарушало инвариант.
    const bg = passport.neutral.anchors.dark;
    const roles = engine.colors.resolveTheme(bg, 'dark').roles;
    const base = parseTranslucent(roles['fill-quaternary']);
    const MID = passport.neutral.anchors.mid;
    const baseL = compositeOklabL(base.tint, base.alpha, bg);
    const oldHlL = compositeOklabL(MID, 0.039, bg); // старый highlight
    expect(oldHlL, 'старый highlight не темнее base — тест не кусался бы').toBeLessThan(baseL);
  });
});
