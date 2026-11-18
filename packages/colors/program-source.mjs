import {
  ProgramWireBuilderV2,
  SURROUND_AVERAGE_V1,
  WCAG22_SC143_TEXT_DEFAULT_V1,
} from '@labpics/colors/program-wire/abi-v2.js';
import { themeProfile } from './profile.mjs';

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
  const graph = {
    bytes: builder.finish(),
    outputs: Object.freeze(Array.from(outputs, ([slot, name]) => Object.freeze({ slot, name }))),
    roles: Object.freeze(
      Object.fromEntries(
        Object.entries(profile.roles).filter(([, value]) => !Array.isArray(value)),
      ),
    ),
    background: Object.freeze([...profile.background]),
    theme,
    contrast,
  };
  graphs.set(key, graph);
  return graph;
}

/** Shared build input for web and native; constructing it does not initialize WASM.
 * Bytes are caller-owned. The cached graph cannot be changed by a consumer.
 */
export function prepareThemeProgram(theme = 'light', contrast = 'normal') {
  const graph = graphFor(theme, contrast);
  return Object.freeze({ ...graph, bytes: graph.bytes.slice() });
}
