import init, { compileProgramWire } from '@labpics/colors';
import { prepareThemeProgram } from './program-source.mjs';

let initialization;
export function initializeColors(input) {
  initialization ??= init(input).catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export class ThemeUpdateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ThemeUpdateError';
    this.code = code;
  }
}

function observedBytes(backgrounds) {
  if (!Array.isArray(backgrounds) || backgrounds.length === 0 || backgrounds.length > 64) {
    throw new ThemeUpdateError('invalid_backgrounds', 'Expected 1–64 observed sRGB8 backgrounds');
  }
  const bytes = new Uint8Array(backgrounds.length * 3);
  for (let index = 0; index < backgrounds.length; index++) {
    const rgb = backgrounds[index];
    if (!Array.isArray(rgb) || rgb.length !== 3) {
      throw new ThemeUpdateError('invalid_backgrounds', 'Expected 1–64 observed sRGB8 backgrounds');
    }
    for (let channel = 0; channel < 3; channel++) {
      const value = rgb[channel];
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new ThemeUpdateError(
          'invalid_backgrounds',
          'Expected 1–64 observed sRGB8 backgrounds',
        );
      }
      bytes[index * 3 + channel] = value;
    }
  }
  return bytes;
}

/** CSS values come only from public outputRgb/outputOpacity, never diagnostics. */
export function createThemeProgram(theme = 'light', contrast = 'normal') {
  const { bytes, outputs: slots, roles, background } = prepareThemeProgram(theme, contrast);
  const outputs = new Map(slots.map(({ slot, name }) => [slot, name]));
  const runtime = compileProgramWire(bytes, 1);
  let revision = 0n;
  let disposed = false;
  return {
    update(backgrounds = [background]) {
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
        for (const [name, value] of Object.entries(roles)) {
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
