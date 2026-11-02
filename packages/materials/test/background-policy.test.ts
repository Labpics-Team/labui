import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';
import {
  LIVE_BLUR_MODES,
  MATERIAL_FILL_FAMILY,
  type MaterialMode,
  canNest,
  isLiveBlur,
} from '../src/background-policy';

/*
 * A. Политика фонов — явный, проверяемый контракт (ADR-0002 §1, ADR-0004 Решение 4):
 *   1. Какие МОДЫ читают живой фон (live-blur): glass / acrylic; solid — нет
 *      (отдельный blur-ярус снесён — ADR-0008, перцептивный дубль acrylic).
 *   2. Инвариант вложенности: live-blur НЕЛЬЗЯ вкладывать в live-blur (двойной
 *      live-блюр = шов). solid вкладывается во что угодно и принимает что угодно.
 *   3. Какое СЕМЕЙСТВО токенов красит собственную заливку материала: только
 *      `--lab-bg-material-*` (материал не тянет произвольные bg-роли).
 *
 * Классы: А (unit, RED-provable на известных входах) + скан-инвариант по material.css.
 */

const ALL_MODES: readonly MaterialMode[] = ['solid', 'glass', 'acrylic'];

describe('isLiveBlur — какие моды читают живой фон', () => {
  it('glass / acrylic читают живой фон', () => {
    expect(isLiveBlur('glass')).toBe(true);
    expect(isLiveBlur('acrylic')).toBe(true);
  });

  it('solid — непрозрачный, живого фона не читает', () => {
    expect(isLiveBlur('solid')).toBe(false);
  });

  it('LIVE_BLUR_MODES = ровно {glass, acrylic} — blur снесён (ADR-0008)', () => {
    expect([...LIVE_BLUR_MODES].sort()).toEqual(['acrylic', 'glass']);
  });

  it('каждый live-blur — не solid, и наоборот (полное разбиение множества мод)', () => {
    for (const m of ALL_MODES) {
      expect(isLiveBlur(m)).toBe(m !== 'solid');
    }
  });
});

describe('canNest — запрет вложенного live-блюра', () => {
  it('live-blur внутри live-blur ЗАПРЕЩЁН (двойной live-блюр = шов)', () => {
    for (const outer of LIVE_BLUR_MODES) {
      for (const inner of LIVE_BLUR_MODES) {
        expect(canNest(outer, inner), `${outer} ⊃ ${inner}`).toBe(false);
      }
    }
  });

  it('всё внутри solid — разрешено (непрозрачный хозяин не даёт шва)', () => {
    for (const inner of ALL_MODES) {
      expect(canNest('solid', inner), `solid ⊃ ${inner}`).toBe(true);
    }
  });

  it('solid внутри live-blur — разрешён (непрозрачный вложенный не создаёт двойного блюра)', () => {
    for (const outer of LIVE_BLUR_MODES) {
      expect(canNest(outer, 'solid'), `${outer} ⊃ solid`).toBe(true);
    }
  });

  it('запрещено СИММЕТРИЧНО ровно для пар live×live', () => {
    for (const outer of ALL_MODES) {
      for (const inner of ALL_MODES) {
        const forbidden = isLiveBlur(outer) && isLiveBlur(inner);
        expect(canNest(outer, inner)).toBe(!forbidden);
      }
    }
  });
});

describe('семейство live-заливок и авторская роль Elevated Solid', () => {
  const css = readMaterialCss();

  it('семейство = префикс --lab-bg-material-', () => {
    expect(MATERIAL_FILL_FAMILY).toBe('--lab-bg-material-');
  });

  it('неизменённые tiers сохраняют material tint-pair, Elevated Solid использует Grouped/Secondary', () => {
    // Source-fidelity oracle: опубликованный Elevated Solid связан с
    // Backgrounds/Neutral/Grouped/Secondary; live-пара остаётся прежней.
    const elevated = css.match(/\.lab-material--elevated\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(elevated).toContain('--_base: var(--lab-bg-grouped-secondary)');
    expect(elevated).toContain('var(--lab-bg-material-elevated-01)');
    expect(elevated).toContain('var(--_material-active, 0) * 100%');
    const withoutElevated = css.replace(/\.lab-material--elevated\s*\{[^}]+\}/, '');
    const fillDecls = [...withoutElevated.matchAll(/--_(?:tint|base):\s*([^;]+);/g)].map((m) =>
      (m[1] as string).trim(),
    );
    expect(fillDecls.length).toBeGreaterThan(0);
    for (const value of fillDecls) {
      const ref = /^var\((--lab-[a-z0-9-]+)\)$/.exec(value);
      expect(ref, `заливка "${value}" обязана быть var(--lab-bg-material-*)`).not.toBeNull();
      expect((ref?.[1] as string).startsWith(MATERIAL_FILL_FAMILY)).toBe(true);
    }
  });
});
