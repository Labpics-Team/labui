import type { ResolvedMotion } from '../build.js';

/**
 * Generate the motion stylesheet: a `:root` block of `--lab-motion-*` custom
 * properties, then a `@media (prefers-reduced-motion: reduce)` block that
 * REDEFINES the semantic properties so reduced-motion is a first-class part of
 * the contract, not a consumer afterthought.
 *
 * Semantic properties are `var()` references to the physical tier — a `:root`
 * override of a physical token reaches every role and every consumer with no
 * rebuild.
 */
export function generateMotionCss(motion: ResolvedMotion): string {
  const root = [
    section('Durations — сохранённая шкала скорости', durationLines(motion)),
    section(
      'Easings — cubic-bezier primitives (overshoot only in `emphasized`)',
      easingLines(motion),
    ),
    section(
      'Springs — canonical (duration, bounce); value is a generated linear() fallback',
      springLines(motion),
    ),
    section(
      'Semantic roles — references into the physical tier (no duplicated values)',
      semanticLines(motion),
    ),
  ].join('\n\n');

  return `${header()}\n:root {\n${root}\n}\n\n${reducedMotionBlock(motion)}`;
}

function header(): string {
  return [
    '/*',
    ' * LabUI motion tokens — GENERATED. Do not edit by hand.',
    ' * Source: packages/tokens/src/motion (config + generator). Run',
    ' * `pnpm --filter @labpics/ui-tokens generate` to regenerate.',
    ' */',
  ].join('\n');
}

function section(title: string, lines: string[]): string {
  return `  /* ${title} */\n${lines.join('\n')}`;
}

function durationLines(motion: ResolvedMotion): string[] {
  return motion.durations.map((d) => decl(d.cssVar, `${d.ms}ms`, d.description));
}

function easingLines(motion: ResolvedMotion): string[] {
  return motion.easings.map((e) => decl(e.cssVar, e.css, e.description));
}

function springLines(motion: ResolvedMotion): string[] {
  const lines: string[] = [];
  for (const s of motion.springs) {
    lines.push(decl(s.cssVar, s.linear, `${s.description} — pair with ${s.durationCssVar}`));
    lines.push(decl(s.durationCssVar, `${s.durationMs}ms`));
  }
  return lines;
}

function semanticLines(motion: ResolvedMotion): string[] {
  const lines: string[] = [];
  for (const s of motion.semantics) {
    lines.push(decl(s.cssVars.duration, s.durationRef, `-> duration.${s.durationName}`));
    lines.push(decl(s.cssVars.easing, s.easingRef, `-> easing.${s.easingName}`));
    if (s.cssVars.spring && s.springRef) {
      lines.push(decl(s.cssVars.spring, s.springRef, `-> spring.${s.springName}`));
    }
  }
  return lines;
}

/**
 * Reduced-motion contract. Every semantic role gets an explicit remap:
 *  - easing → `linear` (all overshoot / spring character removed);
 *  - entrance/exit → a short `fast` duration (vestibular-safe opacity crossfade);
 *  - transition/emphasis → `instant` (a hard snap);
 *  - any semantic spring collapses to `linear`.
 */
function reducedMotionBlock(motion: ResolvedMotion): string {
  const lines: string[] = [];
  for (const s of motion.semantics) {
    lines.push(
      decl(s.cssVars.duration, s.reduced.durationRef, `-> duration.${s.reduced.durationName}`),
    );
    lines.push(decl(s.cssVars.easing, s.reduced.easing));
    if (s.cssVars.spring) {
      lines.push(decl(s.cssVars.spring, s.reduced.easing, 'bounce neutralised'));
    }
  }
  return [
    '/* Reduced-motion — first-class: neutralise overshoot, snap movement, keep a',
    ' * vestibular-safe crossfade for appearance/disappearance. */',
    '@media (prefers-reduced-motion: reduce) {',
    '  :root {',
    ...lines.map((l) => `  ${l}`),
    '  }',
    '}',
    '',
  ].join('\n');
}

function decl(name: string, value: string, comment?: string): string {
  const base = `  ${name}: ${value};`;
  return comment ? `${base} /* ${comment} */` : base;
}
