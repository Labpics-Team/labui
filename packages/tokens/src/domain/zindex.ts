import type { ZIndexConfig } from '../config/types.js';
import type { ResolvedToken } from './token.js';

/**
 * Documented purpose of each semantic z-index layer. Keeping intent next to the
 * value is how z-index wars are prevented — a component reaches for a named
 * layer, never a magic number.
 */
const LAYER_PURPOSE: Readonly<Record<string, string>> = {
  primary: 'Base content plane.',
  secondary: 'Raised content within a context.',
  tertiary: 'Further-raised content.',
  quaternary: 'Top of the in-flow content stack.',
  'grouped-primary': 'Base plane of a grouped surface (card stack, list).',
  'grouped-secondary': 'Raised plane within a grouped surface.',
  'grouped-tertiary': 'Top plane within a grouped surface.',
  inverted: 'Inverted surface plane (contrast island).',
  'skip-link': 'Accessibility skip-to-content link.',
  dropdown: 'Menus, selects, comboboxes, popovers anchored to a trigger.',
  sticky: 'Sticky headers and bars.',
  'modal-underlay': 'Modal scrim / backdrop.',
  modal: 'Dialogs and modal panels.',
  toast: 'Transient notifications.',
  tooltip: 'Top-most hint layer.',
};

/**
 * Build the z-index scale: each level gets `startAt + index * gap`, producing a
 * strictly monotonic, evenly-gapped integer sequence. The gap reserves room to
 * insert a future layer without renumbering the system.
 */
export function buildZIndex(config: ZIndexConfig): ResolvedToken[] {
  assertConfig(config);

  return config.levels.map((name, index) => {
    const value = config.startAt + index * config.gap;
    return {
      kind: 'z',
      name,
      cssValue: String(value),
      numeric: value,
      dtcgType: 'number',
      description: LAYER_PURPOSE[name],
    } satisfies ResolvedToken;
  });
}

function assertConfig(config: ZIndexConfig): void {
  if (config.levels.length === 0) {
    throw new Error('zIndex.levels must not be empty');
  }
  if (config.gap <= 0) {
    throw new Error(`zIndex.gap must be positive, got ${config.gap}`);
  }
  const seen = new Set<string>();
  for (const level of config.levels) {
    if (seen.has(level)) {
      throw new Error(`zIndex.levels has a duplicate level "${level}"`);
    }
    seen.add(level);
  }
}
