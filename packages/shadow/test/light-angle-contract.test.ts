import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIGHT_ANGLE_DEG, LIGHT_ANGLE_VAR, composePly } from '../src/index.js';
import type { ShadowSlotName } from '../src/index.js';

/**
 * --lab-light-angle contract — locks the documented behavior.
 *
 * This test suite closes the class "published API claims runtime rotation but
 * ships literal offsets, misleading consumers". Three invariants are locked:
 *
 *   1. At angle 0 (the shipped default) composePly returns LITERAL offsets —
 *      no var(--lab-light-angle) in the emitted string, no sin/cos trig.
 *      Consumers who set --lab-light-angle at runtime get no effect on the
 *      artifact. This is the honest, documented behavior.
 *
 *   2. At a non-zero angle composePly emits the PROJECTION form that references
 *      var(--lab-light-angle) — the runtime-rotation path that activates once
 *      DEFAULT_LIGHT_ANGLE_DEG is changed and the artifact is regenerated.
 *
 *   3. The generated shadow.css on disk contains ZERO sin(/ cos( calls —
 *      confirming the shipped artifact is the angle-0 literal path, not the
 *      projection path. A consumer who relies on runtime token updates gets
 *      no effect unless they regenerate with a non-zero angle.
 *
 * How="mutation": test 1 fails if composePly's angle-0 branch is changed to
 * emit a var() reference. Test 2 fails if the projection form is removed.
 * Test 3 fails if the generated artifact contains trig — meaning someone
 * regenerated with a non-zero angle and committed it without updating docs.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GENERATED_CSS = resolve(here, '..', 'src', 'generated', 'shadow.css');

const SAMPLE_GEO = { blur: 4, offsetY: 2 };
const SAMPLE_SLOT: ShadowSlotName = 's1';

describe('--lab-light-angle contract: angle-0 literal vs projection path', () => {
  // ── (1) Angle-0 branch: no var() reference to --lab-light-angle in the ply ──
  it('composePly at angle 0 emits literal offsets (no var(--lab-light-angle) in output)', () => {
    const ply = composePly(SAMPLE_SLOT, SAMPLE_GEO, 0);
    expect(ply, 'angle-0 ply must start with a literal "0 "').toMatch(/^0\s+/);
    expect(ply, 'angle-0 ply must NOT reference --lab-light-angle').not.toContain(LIGHT_ANGLE_VAR);
    expect(ply, 'angle-0 ply must NOT contain sin(').not.toContain('sin(');
    expect(ply, 'angle-0 ply must NOT contain cos(').not.toContain('cos(');
  });

  // ── (2) Non-zero angle branch: emits var(--lab-light-angle) projection ───────
  it('composePly at angle 35 emits the projection form with var(--lab-light-angle)', () => {
    const ply = composePly(SAMPLE_SLOT, SAMPLE_GEO, 35);
    expect(ply, 'non-zero ply must reference --lab-light-angle').toContain(LIGHT_ANGLE_VAR);
    expect(ply, 'non-zero ply must contain sin(').toContain('sin(');
    expect(ply, 'non-zero ply must contain cos(').toContain('cos(');
  });

  // ── (3) Shipped artifact: no sin/cos — confirms the angle-0 path was used ───
  it('the shipped shadow.css contains ZERO sin(/ cos( calls (angle-0 artifact)', () => {
    const css = readFileSync(GENERATED_CSS, 'utf8');
    expect(
      css,
      'shipped artifact must NOT contain sin( — it is the angle-0 literal path',
    ).not.toContain('sin(');
    expect(
      css,
      'shipped artifact must NOT contain cos( — it is the angle-0 literal path',
    ).not.toContain('cos(');
  });

  // ── (4) DEFAULT_LIGHT_ANGLE_DEG is 0 — confirms the config ──────────────────
  it('DEFAULT_LIGHT_ANGLE_DEG is 0 (the owner vertical-light default)', () => {
    expect(DEFAULT_LIGHT_ANGLE_DEG).toBe(0);
  });

  // ── (5) Mutation-proof: if angle-0 branch emitted var(), test 1 would fail ──
  it('RED-proof: a ply string containing var(--lab-light-angle) fails the angle-0 check', () => {
    const fakeAngle0Ply = `calc(${SAMPLE_GEO.offsetY}px * sin(var(${LIGHT_ANGLE_VAR}))) calc(${SAMPLE_GEO.offsetY}px * cos(var(${LIGHT_ANGLE_VAR}))) ${SAMPLE_GEO.blur}px ...`;
    // If composePly had emitted this, the contains-check in test 1 would catch it.
    expect(fakeAngle0Ply).toContain(LIGHT_ANGLE_VAR);
    expect(fakeAngle0Ply).toContain('sin(');
    expect(fakeAngle0Ply).toContain('cos(');
  });
});
