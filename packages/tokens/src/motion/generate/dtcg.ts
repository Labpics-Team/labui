import type { ResolvedMotion } from '../build.js';

/**
 * Generate the canonical DTCG document for motion (W3C DTCG 2025.10).
 *
 * Standard types are used where they exist:
 *  - durations  → `$type: "duration"`, `$value: { value, unit: "ms" }`;
 *  - easings    → `$type: "cubicBezier"`, `$value: [x1, y1, x2, y2]`;
 *  - semantics  → `$type: "transition"` composite `{ duration, delay, timingFunction }`,
 *                 with references (`{motion.duration.base}`) instead of duplicated values.
 *
 * Springs have NO first-class DTCG type. They are emitted with graceful
 * degradation — `$type: "cubicBezier"` carrying the fallback curve in `$value`,
 * so a tool that ignores extensions still gets a usable easing — while the full
 * spring is honestly declared under `$extensions."com.labpics.motion"` (the
 * canonical (duration, bounce) pair, the derived triple, and the generated
 * `linear()`). Reduced-motion, which relies on a still-draft DTCG resolver
 * mechanism, is likewise carried in `$extensions`.
 */

const EXT_KEY = 'com.labpics.motion';

interface DtcgNode {
  readonly $type: string;
  readonly $value: unknown;
  readonly $description?: string;
  readonly $extensions?: Record<string, unknown>;
}

type DtcgGroup = { [key: string]: DtcgGroup | DtcgNode };

export function generateMotionDtcg(motion: ResolvedMotion): string {
  const doc: DtcgGroup = {
    motion: {
      duration: durationGroup(motion),
      easing: easingGroup(motion),
      spring: springGroup(motion),
      ...semanticGroup(motion),
    },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function durationGroup(motion: ResolvedMotion): DtcgGroup {
  const group: DtcgGroup = {};
  for (const d of motion.durations) {
    group[d.name] = {
      $type: 'duration',
      $value: { value: d.ms, unit: 'ms' },
      ...(d.description ? { $description: d.description } : {}),
      $extensions: { [EXT_KEY]: { provenance: d.provenance } },
    };
  }
  return group;
}

function easingGroup(motion: ResolvedMotion): DtcgGroup {
  const group: DtcgGroup = {};
  for (const e of motion.easings) {
    group[e.name] = {
      $type: 'cubicBezier',
      $value: [...e.bezier],
      ...(e.description ? { $description: e.description } : {}),
      $extensions: { [EXT_KEY]: { provenance: e.provenance } },
    };
  }
  return group;
}

function springGroup(motion: ResolvedMotion): DtcgGroup {
  const group: DtcgGroup = {};
  for (const s of motion.springs) {
    group[s.name] = {
      // Graceful degradation: extension-blind tools read the fallback bezier.
      $type: 'cubicBezier',
      $value: [...s.fallbackBezier],
      ...(s.description ? { $description: s.description } : {}),
      $extensions: {
        [EXT_KEY]: {
          type: 'spring',
          model: 'duration-bounce',
          category: s.category,
          duration: { value: s.durationS, unit: 's' },
          bounce: s.bounce,
          dampingRatio: round(s.physics.dampingRatio),
          stiffness: round(s.physics.stiffness),
          mass: s.physics.mass,
          web: {
            linear: s.linear,
            cubicBezier: [...s.fallbackBezier],
            duration: { value: s.durationMs, unit: 'ms' },
          },
          provenance: { duration: s.provenanceDuration, bounce: s.provenanceBounce },
        },
      },
    };
  }
  return group;
}

/**
 * Semantic roles as `transition` composites. `timingFunction` references the
 * physical easing; the reduced-motion remap and any backing spring are carried
 * in the extension.
 */
function semanticGroup(motion: ResolvedMotion): DtcgGroup {
  const group: DtcgGroup = {};
  for (const s of motion.semantics) {
    const ext: Record<string, unknown> = {
      provenance: s.provenance,
      reducedMotion: {
        duration: `{motion.duration.${s.reduced.durationName}}`,
        timingFunction: [0, 0, 1, 1],
      },
    };
    if (s.springName) {
      ext.spring = `{motion.spring.${s.springName}}`;
    }
    group[s.name] = {
      $type: 'transition',
      $value: {
        duration: `{motion.duration.${s.durationName}}`,
        delay: { value: 0, unit: 'ms' },
        timingFunction: `{motion.easing.${s.easingName}}`,
      },
      ...(s.description ? { $description: s.description } : {}),
      $extensions: { [EXT_KEY]: ext },
    };
  }
  return group;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
