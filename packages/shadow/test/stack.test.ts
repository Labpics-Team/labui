import { describe, expect, it } from 'vitest';
import {
  DARK_ALPHA_MULTIPLIER_DEFAULT,
  DEFAULT_LIGHT_ANGLE_DEG,
  ELEVATION_LEVELS,
  ELEVATION_ROLES,
  ELEVATION_SHAPES,
  LIGHT_ANGLE_VAR,
  ROLE_TO_SIZE,
  SHADOW_COLOR_VAR,
  SHADOW_SLOTS,
  SLOT_ALPHA,
  alphaVar,
  composeElevation,
  composePly,
  defaultAlphas,
  generateShadowCss,
} from '../src/index.js';

describe('shadow stack — structure', () => {
  it('has exactly the five owner-named elevation sizes', () => {
    expect(ELEVATION_LEVELS).toEqual(['xs', 's', 'm', 'l', 'xl']);
    expect(ELEVATION_SHAPES.map((l) => l.name)).toEqual([...ELEVATION_LEVELS]);
  });

  it('has exactly the four fixed-alpha slots in stack order', () => {
    expect(SHADOW_SLOTS).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('every elevation level has EXACTLY four plies (equal-layeredness 4×5)', () => {
    for (const level of ELEVATION_SHAPES) {
      expect(Object.keys(level.slots).sort()).toEqual(['s1', 's2', 's3', 's4']);
      const value = composeElevation(level, DEFAULT_LIGHT_ANGLE_DEG);
      // Plies are comma-joined; four plies → exactly three top-level commas.
      const plies = value.split('),\n');
      expect(plies.length).toBe(4);
    }
  });
});

describe('shadow stack — fixed per-slot alphas (owner law)', () => {
  it('alphas are 0.12 / 0.04 / 0.02 / 0.01 and identical across all levels', () => {
    expect(defaultAlphas()).toEqual([0.12, 0.04, 0.02, 0.01]);
    expect(SLOT_ALPHA).toEqual({ s1: 0.12, s2: 0.04, s3: 0.02, s4: 0.01 });
  });

  it('the generated contract emits exactly the fixed alphas on :root', () => {
    const css = generateShadowCss();
    expect(css).toContain('--lab-shadow-alpha-s1: 0.12;');
    expect(css).toContain('--lab-shadow-alpha-s2: 0.04;');
    expect(css).toContain('--lab-shadow-alpha-s3: 0.02;');
    expect(css).toContain('--lab-shadow-alpha-s4: 0.01;');
  });

  it('default dark multiplier is 1 — styles export gives one alpha set', () => {
    expect(DARK_ALPHA_MULTIPLIER_DEFAULT).toBe(1);
    const css = generateShadowCss();
    // With multiplier 1 the dark block re-states the same alphas.
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(darkBlock).toContain('--lab-shadow-alpha-s1: 0.12;');
  });
});

describe('shadow stack — verbatim opora ladder at angle 0', () => {
  // The owner's table, transcribed independently of the source module, so this
  // test is a true cross-check (r = blur px, y = offsetY px).
  const TABLE: Record<string, ReadonlyArray<{ r: number; y: number }>> = {
    xs: [
      { r: 1, y: 0 },
      { r: 1, y: 1 },
      { r: 2, y: 2 },
      { r: 2, y: 4 },
    ],
    s: [
      { r: 2, y: 1 },
      { r: 2, y: 2 },
      { r: 4, y: 4 },
      { r: 8, y: 12 },
    ],
    m: [
      { r: 2, y: 1 },
      { r: 4, y: 4 },
      { r: 8, y: 12 },
      { r: 12, y: 24 },
    ],
    l: [
      { r: 8, y: 4 },
      { r: 12, y: 12 },
      { r: 16, y: 24 },
      { r: 24, y: 48 },
    ],
    xl: [
      { r: 36, y: 16 },
      { r: 48, y: 24 },
      { r: 64, y: 36 },
      { r: 96, y: 48 },
    ],
  };

  it('default angle is 0 (vertical light, offset-x 0)', () => {
    expect(DEFAULT_LIGHT_ANGLE_DEG).toBe(0);
  });

  it('each ply at angle 0 is `0 {y}px {r}px <color>` — bit-for-bit the table', () => {
    for (const level of ELEVATION_SHAPES) {
      const expected = TABLE[level.name];
      if (!expected) throw new Error(`no table row for ${level.name}`);
      SHADOW_SLOTS.forEach((slot, i) => {
        const row = expected[i];
        if (!row) throw new Error(`no table cell ${level.name}.${slot}`);
        const ply = composePly(slot, level.slots[slot], 0);
        expect(ply.startsWith(`0 ${row.y}px ${row.r}px `)).toBe(true);
      });
    }
  });

  it('no calc/sin/cos leaks at the default angle — the ladder is literal', () => {
    const css = generateShadowCss();
    // Geometry is literal at angle 0; the only sin/cos path is the non-zero
    // branch, which the default never emits.
    expect(css).not.toContain('sin(');
    expect(css).not.toContain('cos(');
  });
});

describe('shadow stack — non-zero angle rotates via the one token', () => {
  it('a non-zero angle projects throw onto x/y from the single global token', () => {
    const ply = composePly('s4', { blur: 8, offsetY: 12 }, 30);
    expect(ply).toContain(`sin(var(${LIGHT_ANGLE_VAR}))`);
    expect(ply).toContain(`cos(var(${LIGHT_ANGLE_VAR}))`);
  });
});

describe('shadow stack — neutral anchor, opt-in weak tint', () => {
  it('every ply colours through the neutral anchor, never pure black', () => {
    for (const level of ELEVATION_SHAPES) {
      const value = composeElevation(level, DEFAULT_LIGHT_ANGLE_DEG);
      expect(value).toContain(`var(${SHADOW_COLOR_VAR})`);
    }
    const css = generateShadowCss();
    const plies = css
      .split('\n')
      .filter((line) => line.includes('color-mix'))
      .join('\n');
    expect(plies).not.toMatch(/#000\b|#000000\b|rgb\(\s*0\s*,\s*0\s*,\s*0/i);
    expect(plies).not.toContain('black');
  });

  it('the default tint strength is 0 — neutral until a surface opts in', () => {
    const css = generateShadowCss();
    expect(css).toContain('--lab-shadow-tint-strength: 0;');
  });

  it('lightness constraint: the ink base is the dark anchor, tint only nudges it', () => {
    // Each ply mixes (anchor -> tint by strength), then (transparent -> ink by
    // alpha). With the dark anchor #101012 as the mix base, and the tint applied
    // only by --lab-shadow-tint-strength (default 0), the composite ink can
    // never be lighter than #101012 at strength 0 — so on a dark surface the
    // shadow is a shadow, not a glow.
    const ply = composePly('s1', { blur: 2, offsetY: 1 }, 0);
    expect(ply).toContain(`color-mix(in srgb, var(${SHADOW_COLOR_VAR}),`);
    expect(ply).toContain('var(--lab-shadow-tint-strength)');
  });
});

describe('shadow stack — sizes, role aliases, motion', () => {
  it('emits each size in both delivery forms (token + utility class)', () => {
    const css = generateShadowCss();
    for (const size of ELEVATION_LEVELS) {
      expect(css).toContain(`--lab-shadow-${size}:`);
      expect(css).toContain(`.lab-shadow-${size} {`);
    }
  });

  it('role aliases point to their mapped sizes (resting→xs … modal→xl)', () => {
    expect(ROLE_TO_SIZE).toEqual({ resting: 'xs', raised: 's', overlay: 'l', modal: 'xl' });
    const css = generateShadowCss();
    for (const role of ELEVATION_ROLES) {
      expect(css).toContain(`--lab-elevation-${role}: var(--lab-shadow-${ROLE_TO_SIZE[role]});`);
      expect(css).toContain(`.lab-elevation-${role} {`);
    }
  });

  it('emits the motion tokens and wires box-shadow transitions', () => {
    const css = generateShadowCss();
    expect(css).toContain('--lab-shadow-transition-duration:');
    expect(css).toContain('--lab-shadow-transition-easing:');
    expect(css).toContain(
      '--lab-shadow-transition: box-shadow var(--lab-shadow-transition-duration) var(--lab-shadow-transition-easing);',
    );
    expect(css).toContain('transition: var(--lab-shadow-transition);');
  });
});

describe('shadow stack — generated CSS contract', () => {
  it('defines the global angle token, four alpha contracts, five sizes, four roles', () => {
    const css = generateShadowCss();
    expect(css).toContain(`${LIGHT_ANGLE_VAR}: 0deg;`);
    for (const slot of SHADOW_SLOTS) {
      expect(css).toContain(`${alphaVar(slot)}:`);
    }
    for (const size of ELEVATION_LEVELS) {
      expect(css).toContain(`--lab-shadow-${size}:`);
    }
    for (const role of ELEVATION_ROLES) {
      expect(css).toContain(`--lab-elevation-${role}:`);
    }
  });

  it('light and dark differ ONLY in variable values, not in size formulas', () => {
    const css = generateShadowCss();
    for (const size of ELEVATION_LEVELS) {
      const count = css.split(`--lab-shadow-${size}:`).length - 1;
      expect(count).toBe(1);
    }
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('is deterministic — same config in, byte-identical CSS out', () => {
    expect(generateShadowCss()).toBe(generateShadowCss());
  });
});
