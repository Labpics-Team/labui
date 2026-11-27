import type { ResolvedMotion } from '../build.js';

/**
 * Generate the typed TS motion module.
 *
 * Each tier becomes a `const` object of `var(--lab-motion-*)` references plus a
 * string-literal union of its keys. The runtime value is always a `var()`
 * reference, so the live CSS custom property stays the source of truth at paint
 * time — a `:root` override (or `prefers-reduced-motion`) re-themes motion with
 * no rebuild, exactly like the dimension tokens.
 */
export function generateMotionTs(motion: ResolvedMotion): string {
  const parts: string[] = [banner()];

  parts.push(
    scaleConst(
      'motionDuration',
      'MotionDuration',
      motion.durations.map((d) => [d.name, `var(${d.cssVar})`]),
    ),
  );
  parts.push(
    scaleConst(
      'motionEasing',
      'MotionEasing',
      motion.easings.map((e) => [e.name, `var(${e.cssVar})`]),
    ),
  );
  parts.push(
    scaleConst(
      'motionSpring',
      'MotionSpring',
      motion.springs.map((s) => [s.name, `var(${s.cssVar})`]),
    ),
  );
  parts.push(
    scaleConst(
      'motionSpringDuration',
      'MotionSpringDuration',
      motion.springs.map((s) => [s.name, `var(${s.durationCssVar})`]),
    ),
  );
  parts.push(semanticConst(motion));
  parts.push(
    [
      '/** Калибровка тех же ролей для LabMotion runtime; не редактировать. */',
      'export const motionSpringRuntime = {',
      ...motion.springs.map(
        (spring) =>
          `  ${quoteKey(spring.name)}: { response: ${spring.durationS * 1000}, bounce: ${spring.bounce} },`,
      ),
      '} as const;',
      '',
      '/** База относительной скорости runtime; CSS override сохраняет своё действие. */',
      'export const motionSemanticRuntime = {',
      ...motion.semantics.map((semantic) => {
        const duration = motion.durations.find((item) => item.name === semantic.durationName);
        if (!duration) throw new Error(`Missing duration for ${semantic.name}`);
        return `  ${quoteKey(semantic.name)}: { durationMs: ${duration.ms} },`;
      }),
      '} as const;',
    ].join('\n'),
  );

  return `${parts.join('\n\n')}\n`;
}

function banner(): string {
  return [
    '/**',
    ' * LabUI motion tokens — GENERATED. Do not edit by hand.',
    ' *',
    ' * Values are `var(--lab-motion-*)` references: the live CSS custom property',
    ' * (and its `prefers-reduced-motion` remap) is the source of truth at paint',
    ' * time. Import names give compile-time safety and autocomplete.',
    ' */',
  ].join('\n');
}

function scaleConst(
  exportName: string,
  typeName: string,
  entries: ReadonlyArray<readonly [string, string]>,
): string {
  const body = entries.map(([k, v]) => `  ${quoteKey(k)}: '${v}',`).join('\n');
  return [
    `export const ${exportName} = {`,
    body,
    '} as const;',
    '',
    `export type ${typeName}Token = keyof typeof ${exportName};`,
  ].join('\n');
}

/** Semantic roles: nested `{ duration, easing, spring? }` reference objects. */
function semanticConst(motion: ResolvedMotion): string {
  const rows = motion.semantics.map((s) => {
    const fields = [`duration: 'var(${s.cssVars.duration})'`, `easing: 'var(${s.cssVars.easing})'`];
    if (s.cssVars.spring) {
      fields.push(`spring: 'var(${s.cssVars.spring})'`);
    }
    return `  ${quoteKey(s.name)}: { ${fields.join(', ')} },`;
  });
  return [
    'export const motionSemantic = {',
    rows.join('\n'),
    '} as const;',
    '',
    'export type MotionSemanticToken = keyof typeof motionSemantic;',
  ].join('\n');
}

function quoteKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `'${key}'`;
}
