import { describe, expect, it } from 'vitest';
import {
  ELEVATION_LEVELS,
  LAYER_SHAPES,
  SHADOW_LAYERS,
  alphaVar,
  composeElevation,
  composeLayer,
  generateShadowCss,
  provisionalAlpha,
  provisionalAlphas,
  LIGHT_ANGLE_VAR,
  SHADOW_COLOR_VAR,
} from '../src/index.js';
import { ELEVATION_SHAPES } from '../src/domain/elevation.js';

describe('shadow stack — structure', () => {
  it('has exactly the four owner-named layers in stack order', () => {
    expect(SHADOW_LAYERS).toEqual(['minor', 'ambient', 'penumbra', 'major']);
    expect(LAYER_SHAPES.map((l) => l.name)).toEqual([...SHADOW_LAYERS]);
  });

  it('has exactly the four semantic elevation roles', () => {
    expect(ELEVATION_LEVELS).toEqual(['resting', 'raised', 'overlay', 'modal']);
  });

  it('layer distance and blur grow monotonically Minor -> Major', () => {
    for (let i = 1; i < LAYER_SHAPES.length; i++) {
      const prev = LAYER_SHAPES[i - 1];
      const curr = LAYER_SHAPES[i];
      if (!prev || !curr) throw new Error('layer shape missing');
      expect(curr.distance).toBeGreaterThan(prev.distance);
      expect(curr.blur).toBeGreaterThan(prev.blur);
    }
  });

  it('elevation depth grows and alpha damping falls resting -> modal', () => {
    for (let i = 1; i < ELEVATION_SHAPES.length; i++) {
      const prev = ELEVATION_SHAPES[i - 1];
      const curr = ELEVATION_SHAPES[i];
      if (!prev || !curr) throw new Error('elevation shape missing');
      expect(curr.depth).toBeGreaterThan(prev.depth);
      expect(curr.alphaScale).toBeLessThan(prev.alphaScale);
    }
  });
});

describe('shadow stack — single global light angle', () => {
  it('every ply derives x/y offset from the one --lab-light-angle token', () => {
    for (const level of ELEVATION_SHAPES) {
      for (const layer of LAYER_SHAPES) {
        const ply = composeLayer(level, layer);
        expect(ply).toContain(`sin(var(${LIGHT_ANGLE_VAR}))`);
        expect(ply).toContain(`cos(var(${LIGHT_ANGLE_VAR}))`);
      }
    }
  });

  it('no per-level angle leaks — angle appears only via the global var', () => {
    const css = generateShadowCss();
    // The only literal angle in the file is the single token definition.
    const literalAngles = css.match(/\d+deg/g) ?? [];
    expect(literalAngles).toEqual(['35deg']);
  });
});

describe('shadow stack — surface tint, never pure black', () => {
  it('every ply colours through the surface-tint var, not a hex', () => {
    for (const level of ELEVATION_SHAPES) {
      const value = composeElevation(level, LAYER_SHAPES);
      expect(value).toContain(`var(${SHADOW_COLOR_VAR})`);
    }
  });

  it('no ply hardcodes black (#000 / rgb(0,0,0) / pure black keywords)', () => {
    const css = generateShadowCss();
    // Strip the documented fallback anchor lines; the box-shadow plies must be
    // tint-driven only.
    const plies = css
      .split('\n')
      .filter((line) => line.includes('color-mix'))
      .join('\n');
    expect(plies).not.toMatch(/#000\b|#000000\b|rgb\(\s*0\s*,\s*0\s*,\s*0/i);
    expect(plies).not.toContain('black');
  });
});

describe('shadow stack — alpha contract seam', () => {
  it('plies read alpha from --lab-shadow-alpha-* (the lab-colors seam)', () => {
    const resting = ELEVATION_SHAPES[0];
    if (!resting) throw new Error('resting elevation missing');
    for (const layer of LAYER_SHAPES) {
      const ply = composeLayer(resting, layer);
      expect(ply).toContain(`var(${alphaVar(layer.name)})`);
    }
  });

  it('provisional alphas match the Figma FX/Shadow stack (light @1/2/4/12)', () => {
    expect(provisionalAlphas('light')).toEqual([0.01, 0.02, 0.04, 0.12]);
  });

  it('provisional alphas match the Figma FX/Shadow stack (dark @2/4/12/20)', () => {
    expect(provisionalAlphas('dark')).toEqual([0.02, 0.04, 0.12, 0.2]);
  });

  it('dark layer alpha is heavier than light at every layer (Figma anchor)', () => {
    for (const layer of SHADOW_LAYERS) {
      expect(provisionalAlpha('dark', layer)).toBeGreaterThan(provisionalAlpha('light', layer));
    }
  });
});

describe('shadow stack — generated CSS contract', () => {
  it('defines the global angle token, the four alpha contracts, the four roles', () => {
    const css = generateShadowCss();
    expect(css).toContain(`${LIGHT_ANGLE_VAR}: 35deg;`);
    for (const layer of SHADOW_LAYERS) {
      expect(css).toContain(`${alphaVar(layer)}:`);
    }
    for (const level of ELEVATION_LEVELS) {
      expect(css).toContain(`--lab-elevation-${level}:`);
    }
  });

  it('emits each role in both delivery forms (token + utility class)', () => {
    const css = generateShadowCss();
    for (const level of ELEVATION_LEVELS) {
      expect(css).toContain(`--lab-elevation-${level}:`);
      expect(css).toContain(`.lab-elevation-${level} {`);
    }
  });

  it('the class form reads the per-surface tint var so it resolves at the element', () => {
    const css = generateShadowCss();
    // The class body must contain the surface-tint lookup; that is what makes a
    // tinted surface tint its own shadow (the token form cannot, by CSS rules).
    const modalClass = css.slice(css.indexOf('.lab-elevation-modal {'));
    expect(modalClass).toContain('var(--lab-surface-shadow-tint, var(--lab-shadow-color))');
  });

  it('light and dark themes differ ONLY in variable values, not in elevation formulas', () => {
    const css = generateShadowCss();
    // Elevation roles are declared once on :root; theme blocks re-set only the
    // alpha + colour vars. So there is exactly one definition of each role.
    for (const level of ELEVATION_LEVELS) {
      const count = css.split(`--lab-elevation-${level}:`).length - 1;
      expect(count).toBe(1);
    }
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('is deterministic — same config in, byte-identical CSS out', () => {
    expect(generateShadowCss()).toBe(generateShadowCss());
  });
});
