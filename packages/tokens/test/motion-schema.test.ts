import { describe, expect, it } from 'vitest';
import { buildMotion } from '../src/motion/build.js';
import { defaultMotionConfig } from '../src/motion/config.js';
import { generateMotion } from '../src/motion/generate/index.js';
import type { MotionConfig } from '../src/motion/model.js';

/**
 * Schema-validity + provenance-discipline locks for the motion tokens.
 */

const artifacts = generateMotion(defaultMotionConfig);

interface DtcgNode {
  $type: string;
  $value: unknown;
  $extensions?: { 'com.labpics.motion'?: Record<string, unknown> };
}

const doc = JSON.parse(artifacts.dtcg) as {
  motion: {
    duration: Record<string, DtcgNode>;
    easing: Record<string, DtcgNode>;
    spring: Record<string, DtcgNode>;
  };
};

type Bezier = [number, number, number, number];

describe('DTCG export — structural validity', () => {
  it('re-parses to an identical structure (stable, valid JSON)', () => {
    const once = artifacts.dtcg;
    const twice = `${JSON.stringify(JSON.parse(once), null, 2)}\n`;
    expect(twice).toBe(once);
  });

  it('durations are DTCG duration nodes with { value, unit: "ms" }', () => {
    for (const node of Object.values(doc.motion.duration)) {
      expect(node.$type).toBe('duration');
      expect(node.$value).toMatchObject({ unit: 'ms' });
      expect(typeof (node.$value as { value: number }).value).toBe('number');
    }
  });

  it('easings are DTCG cubicBezier nodes: 4 numbers, x coords in [0,1]', () => {
    for (const node of Object.values(doc.motion.easing)) {
      expect(node.$type).toBe('cubicBezier');
      const v = node.$value as Bezier;
      expect(v).toHaveLength(4);
      expect(v[0]).toBeGreaterThanOrEqual(0);
      expect(v[0]).toBeLessThanOrEqual(1);
      expect(v[2]).toBeGreaterThanOrEqual(0);
      expect(v[2]).toBeLessThanOrEqual(1);
    }
  });

  it('overshoot lives ONLY in `emphasized` — every other easing stays within [0,1]', () => {
    for (const [name, node] of Object.entries(doc.motion.easing)) {
      const [, y1, , y2] = node.$value as Bezier;
      const overshoots = y1 > 1 || y2 > 1 || y1 < 0 || y2 < 0;
      if (name === 'emphasized') {
        expect(overshoots).toBe(true);
      } else {
        expect(overshoots).toBe(false);
      }
    }
  });

  it('springs degrade gracefully: cubicBezier $value + honest spring extension', () => {
    for (const node of Object.values(doc.motion.spring)) {
      expect(node.$type).toBe('cubicBezier');
      const ext = node.$extensions?.['com.labpics.motion'] as Record<string, unknown>;
      expect(ext.type).toBe('spring');
      expect(ext.model).toBe('duration-bounce');
      const web = ext.web as { linear: string };
      expect(web.linear.startsWith('linear(')).toBe(true);
    }
  });
});

describe('provenance discipline (ADR-0002) — no fake-(b)', () => {
  /** Recursively collect every `{ class, source }` provenance object in the doc. */
  function collectProvenance(value: unknown, out: Array<{ class: string; source: string }>): void {
    if (value == null || typeof value !== 'object') {
      return;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.class === 'string' && typeof obj.source === 'string') {
      out.push({ class: obj.class, source: obj.source });
    }
    for (const v of Object.values(obj)) {
      collectProvenance(v, out);
    }
  }

  it('every physical token carries a provenance entry', () => {
    const found: Array<{ class: string; source: string }> = [];
    collectProvenance(doc, found);
    // 5 durations + 4 easings + 2 springs × 2 (duration+bounce) + 4 semantics = 17.
    expect(found.length).toBeGreaterThanOrEqual(17);
  });

  it('every provenance class is (b) or (e), and every (b) cites a non-empty source', () => {
    const found: Array<{ class: string; source: string }> = [];
    collectProvenance(doc, found);
    for (const p of found) {
      expect(['b', 'e']).toContain(p.class);
      expect(p.source.trim().length).toBeGreaterThan(0);
      if (p.class === 'b') {
        // A grounded value must reference the research — fake-(b) forbidden.
        expect(p.source.trim().length).toBeGreaterThan(10);
      }
    }
  });
});

describe('CSS emission', () => {
  it('emits a --lab-motion-* custom property for every physical and semantic token', () => {
    const motion = buildMotion(defaultMotionConfig);
    for (const d of motion.durations) {
      expect(artifacts.css).toContain(`${d.cssVar}:`);
    }
    for (const e of motion.easings) {
      expect(artifacts.css).toContain(`${e.cssVar}:`);
    }
    for (const s of motion.springs) {
      expect(artifacts.css).toContain(`${s.cssVar}:`);
      expect(artifacts.css).toContain(`${s.durationCssVar}:`);
    }
    for (const sem of motion.semantics) {
      expect(artifacts.css).toContain(`${sem.cssVars.duration}:`);
      expect(artifacts.css).toContain(`${sem.cssVars.easing}:`);
    }
  });
});

describe('build-time validation — the schema fails loudly, never silently', () => {
  it('rejects a semantic referencing an unknown physical token', () => {
    const broken: MotionConfig = {
      ...defaultMotionConfig,
      semantics: [
        {
          name: 'entrance',
          duration: 'does-not-exist',
          easing: 'standard',
          reduced: { duration: 'fast', easing: 'linear' },
          provenance: { class: 'e', source: 'test' },
        },
      ],
    };
    expect(() => buildMotion(broken)).toThrow(/unknown token/);
  });

  it('rejects an effects spring that overshoots (bounce must be 0)', () => {
    const broken: MotionConfig = {
      ...defaultMotionConfig,
      springs: [
        {
          name: 'bad',
          category: 'effects',
          durationS: 0.3,
          bounce: 0.2,
          fallbackEasing: 'standard',
          provenanceBounce: { class: 'e', source: 'test' },
          provenanceDuration: { class: 'e', source: 'test' },
        },
      ],
    };
    expect(() => buildMotion(broken)).toThrow(/effects/);
  });

  it('rejects a (b) provenance with an empty source (fake-(b))', () => {
    const broken: MotionConfig = {
      ...defaultMotionConfig,
      durations: [{ name: 'fast', ms: 100, provenance: { class: 'b', source: '' } }],
    };
    expect(() => buildMotion(broken)).toThrow(/fake-\(b\)/);
  });
});
