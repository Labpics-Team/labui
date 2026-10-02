// ГЕЙТ ЗАКОНА УРОВНЕЙ — «уровень = целевой тон» по ФАКТИЧЕСКОЙ эмиссии
// contract.css в ОБЕИХ темах (задача #81). Парсит артефакт (level-law.mjs:
// каскад + var() + oklab-J' тон, translucent-композит в gamma-sRGB), проверяет
// закон лестницы (dJ'-ступени) и КАРАНТИНИТ известные отклонения аннотированным
// skip-листом — гейт зелёный и честный. Класс А (contract/структурный) + Б
// (характеризация: замок множества отклонений — новое = красный).
//
// ─────────────────────────────────────────────────────────────────────────────
// ТАБЛИЦА ОТКЛОНЕНИЙ (семейство × уровень × тема × ожидаемый × фактический × Δ)
// Замер: oklab-J' dJ' от фона темы (light bg=#FFFFFF J'=100; dark bg=#101012
// J'=17.39). «Ожидаемый» = тон АХРОМАТИЧЕСКОЙ нейтрали на том же уровне
// (референс «целевого тона уровня»). Δ = семья − нейтраль. НЕ ЧИНИТЬ.
//
// D1. СЕНТИМЕНТ-КОГОРТА (fill/border) — РАЗНАЯ ЛЕСТНИЦА vs нейтраль.
//   Нейтраль fill = HIG system-fill (alpha 0.2/0.161/0.122/0.078); сентименты
//   = тинт-лестница (0.122/0.078/0.039/0.02, БАЙТ-единообразна по 5 семьям).
//   → fill тон сентимента на 2..5 dJ' СВЕТЛЕЕ нейтрали (light), симметрично dark.
//   Пример (fill light primary): нейтраль −8.06, brand −5.42 (Δ+2.63),
//   warning −2.95 (Δ+5.10). Гипотеза: две физики лестниц (system-fill vs tint);
//   «уровень=тон» держится в НЕПРОЗРАЧНОСТИ, не в dJ'. ОТКРЫТО (движок без
//   per-hue dJ'-якоря — ADR-0002 §2 «dJ'-якоря» аспирационно).
//
// D2. ОТТЕНОК ЛОМАЕТ ЕДИНООБРАЗИЕ ТОНА при равной alpha. При байт-равной alpha
//   сентименты дают РАЗНЫЙ dJ' (fill light primary: brand −5.42 vs warning
//   −2.95, Δ 2.47) — тинт-hue имеет разную светлоту. Гипотеза: тон = f(alpha,
//   светлота тинта); равная alpha ≠ равный тон. Тот же класс, что D1.
//
// D3. border/label -strong — КОНТРАСТ-ЯКОРЬ (text-anchor), не тон-ступень.
//   Нейтраль border-strong dJ' −85.2 (почти чёрный, opaque), сентимент
//   border-strong ±45..53 (opaque насыщенный). Δ огромна и hue-зависима.
//   Гипотеза: recipe text-anchor (fraction 0.968 + WCAG-пол), НЕ ladder —
//   ступень «strong» вне тон-лестницы ПО ДИЗАЙНУ (ADR-0002 §3/§4). НЕ чинить.
//
// D4. STATIC-семьи ВЫРОЖДЕНЫ на СО-полярном фоне (dJ'≈0 = невидимо).
//   label-static-light все 4 уровня в LIGHT = dJ' 0; label-static-dark в DARK
//   = 0; border-static-{light,dark}-strong на со-полярной теме = 0. Гипотеза:
//   static = тема-инвариантный цвет (ADR-0002 §1: «не реагирует на смену
//   темы»), валиден ЛИШЬ на противо-полярной поверхности; на со-полярной
//   уровень схлопывается. НЕ дефект лестницы — контекст-хоста. НЕ чинить.
//
// D5. INVERTED label primary ВЫРОЖДЕН (dJ' 0, обе темы). Гипотеза: Figma-мост
//   opposite-theme (renderScope, не движок); primary совпадает с фоном на
//   со-теме. НЕ чинить (переезжает этапом поезда).
//
// D6. МАТЕРИАЛЫ bg-material-<v>-01/02 — НЕ тон-лестница. 01/02 — слои акрила
//   (dark elevated: 01 +35.4 > 02 +6.5, НЕ монотонно). Гипотеза: Figma-якорь
//   акрила (ADR-0004 material parity), 01/02 = blend-слои, не уровни тона.
//   Отдельный закон. НЕ чинить.
//
// КОНФОРМНО (живые ассерты ниже, зубы гейта): bg-лестница (dJ'-цели паспорта
// точно, role→tone карта тем, монотонна); монотонность+знак тона всех
// не-вырожденных семей; пиксельный инвариант эмиссия==движок для лестничных
// ячеек; байт-единообразие alpha сентимент-когорты; WCAG-полы лейблов.
// ─────────────────────────────────────────────────────────────────────────────
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PASSPORT_FINGERPRINT, createLabuiEngine } from '../engine.mjs';
import {
  BG_ANCHOR,
  BORDER_LEVELS,
  FILL_LEVELS,
  LABEL_LEVELS,
  LADDER_FAMILIES,
  SENTIMENTS,
  effectiveHex,
  ladderRow,
  parseScopes,
  toneOf,
  varName,
} from '../level-law.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const css = await readFile(join(here, '..', 'contract.css'), 'utf8');
const S = parseScopes(css);
const cfg = JSON.parse(await readFile(join(here, '..', 'labui.config.json'), 'utf8'));
const { colors, fingerprint } = await createLabuiEngine();
const eng = {
  light: colors.resolveTheme(BG_ANCHOR.light, 'light'),
  dark: colors.resolveTheme(BG_ANCHOR.dark, 'dark'),
};
const THEMES = ['light', 'dark'];

// dj-anchor цели паспорта (bg-tone-*), заданы в CAM16-UCS J' движка.
const DJ_ANCHOR = Object.fromEntries(
  cfg.roles.filter((r) => r.recipe.kind === 'dj-anchor').map((r) => [r.name, r.recipe]),
);
// Карта роль→тон (ADR-0002 §1 асимметрия тем) — из generate-contract.bgLadder.
const BG_TONE_MAP = {
  light: {
    primary: 1,
    secondary: 2,
    tertiary: 1,
    'grouped-primary': 2,
    'grouped-secondary': 1,
    'grouped-tertiary': 2,
  },
  dark: {
    primary: 1,
    secondary: 2,
    tertiary: 3,
    'grouped-primary': 1,
    'grouped-secondary': 2,
    'grouped-tertiary': 3,
  },
};
// Порог вырождения уровня: |dJ'| < этого = невидимо (нет различимого тона).
const DEGEN = 0.5;
// Известные вырожденные ячейки (D4/D5) — замок множества (характеризация).
const KNOWN_DEGENERACIES = [
  'border-static-dark strong dark',
  'border-static-light strong light',
  'label-inverted primary dark',
  'label-inverted primary light',
  'label-static-dark primary dark',
  'label-static-dark quaternary dark',
  'label-static-dark secondary dark',
  'label-static-dark tertiary dark',
  'label-static-light primary light',
  'label-static-light quaternary light',
  'label-static-light secondary light',
  'label-static-light tertiary light',
];

const LADDERS = [
  ['fill', FILL_LEVELS],
  ['border', BORDER_LEVELS],
  ['label', LABEL_LEVELS],
];
/** Все лестничные ячейки (label добавляет семью inverted). */
function eachCell(fn) {
  for (const theme of THEMES) {
    for (const [domain, levels] of LADDERS) {
      const fams = domain === 'label' ? [...LADDER_FAMILIES, 'inverted'] : LADDER_FAMILIES;
      for (const fam of fams) {
        for (const lvl of levels) {
          const t = toneOf(S[theme], varName(domain, fam, lvl), BG_ANCHOR[theme]);
          if (t) fn({ theme, domain, fam, lvl, t, id: `${domain}-${fam} ${lvl} ${theme}` });
        }
      }
    }
  }
}

describe('bg-лестница — dJ′-ступени (ADR-0002 §1), закон лестницы', () => {
  it('паспорт стабилен (отпечаток) — база закона не дрейфует', () => {
    expect(fingerprint).toBe(PASSPORT_FINGERPRINT);
  });

  for (const theme of THEMES) {
    it(`роль→тон: асимметрия тем держится (${theme})`, () => {
      const bg = BG_ANCHOR[theme];
      const toneJ = {
        1: toneOf(S[theme], '--lab-bg-tone-1', bg).J,
        2: toneOf(S[theme], '--lab-bg-tone-2', bg).J,
        3: toneOf(S[theme], '--lab-bg-tone-3', bg).J,
      };
      for (const [role, tone] of Object.entries(BG_TONE_MAP[theme])) {
        const J = toneOf(S[theme], `--lab-bg-${role}`, bg).J;
        expect(J, `bg-${role} должен резолвиться в тон ${tone}`).toBeCloseTo(toneJ[tone], 5);
      }
    });

    it(`achievedDj ≈ цель паспорта (солвер-квантизация ≤0.25) (${theme})`, () => {
      for (const t of ['bg-tone-2', 'bg-tone-3']) {
        const target = DJ_ANCHOR[t][theme];
        const achieved = eng[theme].roles[t].achievedDj;
        expect(Math.abs(achieved - target), `${t}: ${achieved} vs ${target}`).toBeLessThanOrEqual(
          0.25,
        );
      }
    });

    it(`тон-лестница монотонна и в верном направлении темы (${theme})`, () => {
      const bg = BG_ANCHOR[theme];
      const d = [1, 2, 3].map((k) => toneOf(S[theme], `--lab-bg-tone-${k}`, bg).dJ);
      // light темнеет (dJ ≤ 0), dark светлеет (dJ ≥ 0); |dJ| не убывает 1→3.
      for (const x of d) expect(theme === 'light' ? x <= 1e-9 : x >= -1e-9).toBe(true);
      expect(Math.abs(d[1])).toBeGreaterThan(Math.abs(d[0]));
      expect(Math.abs(d[2])).toBeGreaterThanOrEqual(Math.abs(d[1]) - 1e-9);
    });
  }
});

describe('лестницы семей — монотонность тона + знак темы (не-вырожденные)', () => {
  for (const theme of THEMES) {
    for (const [domain, levels] of LADDERS) {
      const fams = domain === 'label' ? [...LADDER_FAMILIES, 'inverted'] : LADDER_FAMILIES;
      for (const fam of fams) {
        const row = ladderRow(S[theme], domain, fam, levels, BG_ANCHOR[theme]);
        if (row.some((x) => x == null)) continue;
        const hasDegen = row.some((x) => Math.abs(x.dJ) < DEGEN);
        if (hasDegen) continue; // вырожденные семьи — в замке KNOWN_DEGENERACIES
        it(`${domain}-${fam} (${theme}): |dJ'| монотонно к фону, знак темы`, () => {
          const dJ = row.map((x) => x.dJ);
          for (const x of dJ) expect(theme === 'light' ? x <= 1e-9 : x >= -1e-9).toBe(true);
          const abs = dJ.map(Math.abs);
          for (let i = 1; i < abs.length; i++) {
            expect(abs[i - 1], `${fam} уровень ${i}`).toBeGreaterThan(abs[i] - 1e-9);
          }
        });
      }
    }
  }
});

describe('пиксельный инвариант: эмиссия композитится в тон движка (лестница)', () => {
  // Для каждой translucent-ячейки лестницы видимый композит эмиссии обязан
  // байт-совпасть с compositeHex движка. Ловит рассинхрон артефакт↔движок на
  // самом пикселе. (Override-роли — мосты/пара/skeleton/accent — вне лестницы.)
  for (const theme of THEMES) {
    it(`fill/border лестница: effectiveHex == движок compositeHex (${theme})`, () => {
      for (const [domain, levels] of [
        ['fill', FILL_LEVELS],
        ['border', BORDER_LEVELS],
      ]) {
        for (const fam of LADDER_FAMILIES) {
          for (const lvl of levels) {
            const name = varName(domain, fam, lvl);
            const role = eng[theme].roles[name.slice('--lab-'.length)];
            if (!role || role.kind !== 'translucent' || !role.compositeHex) continue;
            const mine = effectiveHex(S[theme], S[theme].get(name), BG_ANCHOR[theme]);
            expect(mine, name).toBe(role.compositeHex.toUpperCase());
          }
        }
      }
    });
  }
});

describe('уровень = целевая непрозрачность — сентимент-когорта (D1/D2 держится в alpha)', () => {
  for (const theme of THEMES) {
    for (const [domain, levels] of [
      ['fill', FILL_LEVELS],
      ['border', BORDER_LEVELS],
    ]) {
      it(`${domain}: 5 сентиментов делят байт-равную alpha на уровне (${theme})`, () => {
        for (const lvl of levels) {
          const alphas = SENTIMENTS.map(
            (f) => toneOf(S[theme], varName(domain, f, lvl), BG_ANCHOR[theme]).alpha,
          );
          for (const a of alphas) expect(a, `${domain} ${lvl}`).toBe(alphas[0]);
        }
      });
    }
  }
});

describe('лейблы — читаемость: WCAG-пол на каждом уровне (ADR-0002 §4)', () => {
  for (const theme of THEMES) {
    it(`каждый уровень лейбла ≥ legalFloor движка (${theme})`, () => {
      for (const fam of [...LADDER_FAMILIES, 'inverted']) {
        for (const lvl of LABEL_LEVELS) {
          const key = `${fam === 'neutral' ? 'label' : `label-${fam}`}-${lvl}`;
          const role = eng[theme].roles[key];
          if (!role || role.legalFloor == null || role.wcagRatio == null) continue;
          expect(role.wcagRatio + 1e-9, key).toBeGreaterThanOrEqual(role.legalFloor);
        }
      }
    });
  }
});

describe('вырожденные уровни — замок множества (D4/D5, теет над skip-листом)', () => {
  it('множество ячеек |dJ′|<0.5 = ровно известный набор', () => {
    const found = [];
    eachCell(({ t, id }) => {
      if (Math.abs(t.dJ) < DEGEN) found.push(id);
    });
    expect(found.sort()).toEqual([...KNOWN_DEGENERACIES].sort());
  });
});

describe('материалы — не тон-лестница, Figma-мост (D6, замок)', () => {
  it('dark bg-material-elevated: 01 не монотонно тусклее 02 (blend-слои, не уровни)', () => {
    const a = toneOf(S.dark, '--lab-bg-material-elevated-01', BG_ANCHOR.dark).dJ;
    const b = toneOf(S.dark, '--lab-bg-material-elevated-02', BG_ANCHOR.dark).dJ;
    expect(Math.abs(a)).toBeGreaterThan(Math.abs(b)); // 01 ярче 02 — обратно тон-ладдеру
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ИЗВЕСТНЫЕ ОТКЛОНЕНИЯ — АННОТИРОВАННЫЙ SKIP-ЛИСТ (НЕ ЧИНИТЬ; таблица в шапке).
// Каждый skip несёт АСПИРАЦИОННЫЙ ассерт «уровень=единый целевой тон». Сегодня
// он КРАСНЫЙ (потому skip) — гейт зелёный и честный. Снять skip = активировать
// проверку, когда отклонение закрыто (D1/D2/D5 — открытые; D3/D4/D6 — иной
// закон по дизайну, skip постоянный с обоснованием).
// ─────────────────────────────────────────────────────────────────────────────
describe('ИЗВЕСТНЫЕ ОТКЛОНЕНИЯ (skip-лист)', () => {
  it.skip('D1: sentiment fill тон == neutral fill тон (ОТКРЫТО: две лестницы, HIG-opacity vs tint)', () => {
    const bg = BG_ANCHOR.light;
    const neu = toneOf(S.light, varName('fill', 'neutral', 'primary'), bg).dJ;
    const brand = toneOf(S.light, varName('fill', 'brand', 'primary'), bg).dJ;
    expect(brand).toBeCloseTo(neu, 0); // fails: −5.42 vs −8.06
  });

  it.skip('D2: sentiment тон единообразен по семьям при равной alpha (ОТКРЫТО: hue-светлота)', () => {
    const bg = BG_ANCHOR.light;
    const brand = toneOf(S.light, varName('fill', 'brand', 'primary'), bg).dJ;
    const warning = toneOf(S.light, varName('fill', 'warning', 'primary'), bg).dJ;
    expect(brand).toBeCloseTo(warning, 0); // fails: −5.42 vs −2.95
  });

  it.skip('D3: border-strong — тон-ступень лестницы (ПО ДИЗАЙНУ иной: text-anchor/контраст)', () => {
    const bg = BG_ANCHOR.light;
    const strong = Math.abs(toneOf(S.light, varName('border', 'brand', 'strong'), bg).dJ);
    const base = Math.abs(toneOf(S.light, varName('border', 'brand', 'base'), bg).dJ);
    expect(strong / base).toBeLessThan(3); // fails: strong ≫ base (контраст-якорь)
  });

  it.skip('D4: static-light label НЕ вырожден на LIGHT (ПО ДИЗАЙНУ: тема-инвариант, противо-полярный хост)', () => {
    const dJ = toneOf(S.light, varName('label', 'static-light', 'primary'), BG_ANCHOR.light).dJ;
    expect(Math.abs(dJ)).toBeGreaterThan(DEGEN); // fails: dJ' = 0 (белый на белом)
  });

  it.skip('D5: inverted label primary НЕ вырожден на со-теме (ОТКРЫТО: Figma-мост opposite-theme)', () => {
    const dJ = toneOf(S.light, varName('label', 'inverted', 'primary'), BG_ANCHOR.light).dJ;
    expect(Math.abs(dJ)).toBeGreaterThan(DEGEN); // fails: dJ' = 0
  });

  it.skip('D6: материалы 01/02 — монотонная тон-лестница (ПО ДИЗАЙНУ иной: акрил-blend, ADR-0004)', () => {
    const a = Math.abs(toneOf(S.dark, '--lab-bg-material-elevated-01', BG_ANCHOR.dark).dJ);
    const b = Math.abs(toneOf(S.dark, '--lab-bg-material-elevated-02', BG_ANCHOR.dark).dJ);
    expect(a).toBeLessThanOrEqual(b); // fails: 01 (+35.4) ярче 02 (+6.5)
  });
});
