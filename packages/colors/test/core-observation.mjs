import { compileProgramWire, evaluateWcag22 } from '@labpics/colors';
import {
  ProgramWireBuilderV1,
  SURROUND_AVERAGE_V1,
  WCAG22_SC143_TEXT_DEFAULT_V1,
} from '@labpics/colors/program-wire/abi-v1.js';

export const rgbHex = (rgb) => `#${rgb.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;

/** Чтение конечного композита у численного владельца; локальной композиции нет. */
export function composePaint({ rgb, opacity }, background) {
  const wire = new ProgramWireBuilderV1()
    .source(11, rgb)
    .fixedTarget(21, 11)
    .solidPaint(41, 21)
    .opacityInput(32, opacity)
    .opacityPaint(42, 41, 32)
    .surfaceInputPort(31)
    .inputSurface(51, 31)
    .sourceOverOccurrence(61, 42, 51, 64, 0.2, SURROUND_AVERAGE_V1)
    .presentationRoot(71, 61)
    .presentationTarget(71, 61)
    .wcag22VisibleUnary(false, 81, 61, WCAG22_SC143_TEXT_DEFAULT_V1)
    .output(91, 42)
    .finish();
  const runtime = compileProgramWire(wire, 1);
  let snapshot;
  try {
    snapshot = runtime.updateObserved(1n, new Uint32Array([37]), Uint8Array.from(background), 1);
    if (snapshot.state !== 'ready')
      throw new Error(`Core composite: ${snapshot.state}: ${snapshot.reason}`);
    return [...snapshot.presentationCompositeRgb(71, 37)];
  } finally {
    snapshot?.free();
    runtime.free();
  }
}

export function luminance(rgb) {
  const bounds = evaluateWcag22(
    rgbHex(rgb),
    '#000000',
    'sc-1.4.3-text-default',
  ).foregroundLuminanceQ55;
  return { lower: BigInt(bounds.lower), upper: BigInt(bounds.upper) };
}

export function pairPixels(surface, text, backdrop) {
  const background = composePaint(surface, backdrop);
  return { background, foreground: composePaint(text, background) };
}
