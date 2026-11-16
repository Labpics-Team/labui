import init, { compileProgramWire } from '@labpics/colors';
import {
  ProgramWireBuilderV2,
  SURROUND_AVERAGE_V1,
  WCAG22_SC143_TEXT_DEFAULT_V1,
} from '@labpics/colors/program-wire/abi-v2.js';
import { themeProfile } from './profile.mjs';

let initialization;
export function initializeColors(input) {
  initialization ??= init(input).catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

/** The public package compiles immutable graphs; each scope has its own session. */
const graphs = new Map();
function graphFor(theme, contrast) {
  const key = `${theme}/${contrast}`;
  if (graphs.has(key)) return graphs.get(key);
  const profile = themeProfile(theme, contrast);
  const builder = new ProgramWireBuilderV2();
  let id = 1;
  const input = id++;
  const background = id++;
  builder.surfaceInputPort(input).inputSurface(background, input);
  const sources = new Map();
  const paints = new Map();
  const outputs = new Map();
  let primary;
  const colorPaint = (color) => {
    const key = color.join(',');
    if (paints.has(key)) return paints.get(key);
    const rgbKey = color.slice(0, 3).join(',');
    let solid = sources.get(rgbKey);
    if (solid === undefined) {
      const source = id++;
      const target = id++;
      solid = id++;
      builder
        .source(source, color.slice(0, 3))
        .fixedTarget(target, source)
        .solidPaint(solid, target);
      sources.set(rgbKey, solid);
    }
    let paint = solid;
    if (color[3] !== 1) {
      const opacity = id++;
      paint = id++;
      builder.opacityInput(opacity, color[3]).opacityPaint(paint, solid, opacity);
    }
    paints.set(key, paint);
    return paint;
  };
  if (contrast === 'more') {
    const target = id++;
    const preferred = id++;
    const alternate = id++;
    primary = id++;
    const rgb = profile.resolve('label-primary').slice(0, 3);
    const opposite = themeProfile(theme === 'light' ? 'dark' : 'light').resolve('label-primary');
    builder
      .finiteTarget(target, [
        { id: preferred, rgb, opacity: 1 },
        { id: alternate, rgb: opposite.slice(0, 3), opacity: 1 },
      ])
      .solidPaint(primary, target)
      .selectionRelease(1n, [
        [{ id: id++, choices: [{ target, candidate: preferred }] }],
        [{ id: id++, choices: [{ target, candidate: alternate }] }],
      ]);
  }
  for (const [name, value] of Object.entries(profile.roles)) {
    if (!Array.isArray(value)) continue;
    const paint = name === 'label-primary' && primary !== undefined ? primary : colorPaint(value);
    const occurrence = id++;
    const root = id++;
    const constraint = id++;
    const slot = id++;
    builder
      .sourceOverOccurrence(occurrence, paint, background, 64, 0.2, SURROUND_AVERAGE_V1)
      .presentationRoot(root, occurrence)
      .presentationTarget(root, occurrence)
      .wcag22VisibleUnary(
        contrast === 'more' && name === 'label-primary',
        constraint,
        occurrence,
        WCAG22_SC143_TEXT_DEFAULT_V1,
      )
      .output(slot, paint);
    outputs.set(slot, name);
  }
  const graph = { bytes: builder.finish(), outputs, profile };
  graphs.set(key, graph);
  return graph;
}

export class ThemeUpdateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ThemeUpdateError';
    this.code = code;
  }
}

function observedBytes(backgrounds) {
  if (
    !Array.isArray(backgrounds) ||
    backgrounds.length === 0 ||
    backgrounds.length > 64 ||
    backgrounds.some(
      (rgb) =>
        !Array.isArray(rgb) ||
        rgb.length !== 3 ||
        rgb.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255),
    )
  ) {
    throw new ThemeUpdateError('invalid_backgrounds', 'Expected 1–64 observed sRGB8 backgrounds');
  }
  return new Uint8Array(backgrounds.flat());
}

/** CSS values come only from public outputRgb/outputOpacity, never diagnostics. */
export function createThemeProgram(theme = 'light', contrast = 'normal') {
  const { bytes, outputs, profile } = graphFor(theme, contrast);
  const runtime = compileProgramWire(bytes, 1);
  let revision = 0n;
  let disposed = false;
  return {
    update(backgrounds = [profile.background]) {
      if (disposed) throw new ThemeUpdateError('disposed', 'Theme program has been disposed');
      const surfaces = observedBytes(backgrounds);
      const snapshot = runtime.updateObserved(
        ++revision,
        Uint32Array.from(backgrounds, (_, index) => index + 1),
        surfaces,
        1,
      );
      try {
        if (snapshot.state !== 'ready') {
          throw new ThemeUpdateError(
            'contrast_unsatisfied',
            'No palette satisfies all observed backgrounds',
          );
        }
        const values = {};
        for (let index = 0; index < snapshot.outputCount(); index++) {
          const name = outputs.get(snapshot.outputSlot(index));
          if (name === undefined)
            throw new ThemeUpdateError('invalid_output', 'Unknown output slot');
          const rgb = snapshot.outputRgb(index);
          const opacity = snapshot.outputOpacity(index);
          values[`--lab-${name}`] = `rgb(${rgb.join(' ')}${opacity === 1 ? '' : ` / ${opacity}`})`;
        }
        for (const [name, value] of Object.entries(profile.roles)) {
          if (Array.isArray(value)) continue;
          values[`--lab-${name}`] =
            typeof value === 'string' ? `var(--lab-${value.slice(1)})` : String(value);
        }
        return Object.freeze(values);
      } finally {
        snapshot.free();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.free();
    },
  };
}
