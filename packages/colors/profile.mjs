import { authoredBadgeRoles } from './authored-paints.mjs';
import config from './labui.config.json' with { type: 'json' };

export const THEMES = Object.freeze(Object.keys(config.themes));
export const CONTRASTS = Object.freeze(['normal', 'more']);

function anchorColor(source, anchorName, theme, contrast) {
  const anchor = source.anchors[anchorName];
  if (!anchor) throw new TypeError(`Missing LabUI anchor: ${anchorName}`);
  if (Array.isArray(anchor)) return anchor;
  return contrast === 'more' && anchor.increased ? anchor.increased[theme] : anchor[theme];
}

/** Resolve the product's relationships, never colour math. */
export function themeProfile(theme = 'light', contrast = 'normal', source = config) {
  if (!THEMES.includes(theme) || !CONTRASTS.includes(contrast)) {
    throw new TypeError(`Unknown LabUI theme: ${theme}/${contrast}`);
  }
  const roles = {};
  for (const [name, value] of Object.entries({ ...source.roles, ...source.themes[theme] })) {
    if (typeof value !== 'object') {
      roles[name] = value;
      continue;
    }
    const labelContrast =
      name.startsWith('label-') || value.increasedOpacity !== undefined ? contrast : 'normal';
    roles[name] = [
      ...anchorColor(source, value.anchor, theme, labelContrast),
      labelContrast === 'more' ? (value.increasedOpacity ?? 1) : value.opacity,
    ];
  }
  const resolve = (name, seen = new Set()) => {
    if (seen.has(name)) throw new TypeError(`Cyclic LabUI role: ${name}`);
    seen.add(name);
    const value = roles[name];
    if (typeof value === 'string' && value.startsWith('@')) {
      return resolve(value.slice(1), seen);
    }
    if (value === undefined) throw new TypeError(`Missing LabUI role: ${name}`);
    return value;
  };
  if (contrast === 'more') {
    for (const level of ['secondary', 'tertiary', 'quaternary']) {
      roles[`label-${level}`] = '@label-primary';
    }
    roles['border-strong'] = '@label-primary';
  }
  Object.assign(roles, authoredBadgeRoles(theme, contrast, source));
  return { theme, contrast, roles, resolve, background: resolve('bg-primary').slice(0, 3) };
}
