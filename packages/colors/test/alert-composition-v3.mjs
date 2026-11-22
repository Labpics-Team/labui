/** Diagnostic consumer, not a production color policy. Requires the V3 Colors artifact. */
import { compileProgramWire } from '@labpics/colors';
import { ProgramWireBuilderV3 } from '@labpics/colors/program-wire/abi-v3.js';
import components from '@labpics/ui-tokens/components.json' with { type: 'json' };
import { themeProfile } from '../profile.mjs';

export function createAlertCompositionProbe(theme, anchorMeaning) {
  if (!['source', 'visible'].includes(anchorMeaning)) throw new TypeError('Unknown anchor meaning');
  const profile = themeProfile(theme);
  const builder = new ProgramWireBuilderV3().surfaceInputPort(1).inputSurface(2, 1);
  const targets = [];
  const outputs = new Map();
  const authored = {};
  let id = 3;
  // Real component anatomy supplies the applications. Equal RGB/roles do not merge uses.
  for (const [part, role] of Object.entries(components.alert.roles)) {
    if (part === 'icon') continue; // The actual fixture renders the danger icon.
    const color = profile.resolve(role);
    authored[part] = color;
    const target = id++;
    const base = id++;
    const occurrence = id++;
    targets.push(target);
    builder
      .colorTarget(
        target,
        color.slice(0, 3),
        anchorMeaning === 'visible' ? { appearance: occurrence } : {},
      )
      .solidPaint(base, target);
    let paint = base;
    if (color[3] !== 1) {
      const opacity = id++;
      paint = id++;
      builder.opacityInput(opacity, color[3]).opacityPaint(paint, base, opacity);
    }
    builder.pointOccurrence(occurrence, paint, 2);
    // The text requirement is identical for heading and description. It must not
    // be made artificially different to imitate a missing hierarchy relation.
    if (part === 'heading' || part === 'description')
      builder.wcag22VisibleUnary(true, id++, occurrence, 1);
    if (part === 'close' || part === 'focus') builder.wcag22VisibleUnary(true, id++, occurrence, 3);
    if (part === 'dangerIcon') builder.wcag22VisibleUnary(true, id++, occurrence, 4);
    const slot = id++;
    builder.output(slot, paint);
    outputs.set(slot, part);
  }
  const bytes = builder.assignment(targets).finish();
  const program = compileProgramWire(bytes, 1);
  let revision = 0n;
  let accepted = null;
  return {
    authored,
    bytes,
    update(background) {
      const started = performance.now();
      const snapshot = program.updateObserved(
        ++revision,
        Uint32Array.of(1),
        Uint8Array.from(background),
        1,
      );
      try {
        const state = snapshot.state;
        const colors = Object.fromEntries(
          Array.from({ length: snapshot.outputCount() }, (_, index) => [
            outputs.get(snapshot.outputSlot(index)),
            [...snapshot.outputRgb(index), snapshot.outputOpacity(index)],
          ]),
        );
        const result = { state, background, colors, elapsedMs: performance.now() - started };
        if (state === 'ready') accepted = result;
        return { ...result, accepted };
      } finally {
        snapshot.free();
      }
    },
    dispose() {
      program.free();
    },
  };
}
