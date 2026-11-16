import config from './labui.config.json' with { type: 'json' };

export const THEMES = Object.freeze(Object.keys(config.themes));
export const CONTRASTS = Object.freeze(['normal', 'more']);

/** Resolve the product's relationships, never colour math. */
export function themeProfile(theme = 'light', contrast = 'normal') {
  if (!THEMES.includes(theme) || !CONTRASTS.includes(contrast)) {
    throw new TypeError(`Unknown LabUI theme: ${theme}/${contrast}`);
  }
  const roles = {};
  for (const [name, value] of Object.entries(config.themes[theme])) {
    roles[name] = Array.isArray(value) ? [...value] : value;
  }
  if (contrast === 'more') {
    for (const [name, value] of Object.entries(roles)) {
      if (!name.startsWith('label-') || !Array.isArray(value)) continue;
      value[3] = 1;
      const family = name.split('-')[1];
      const anchor = config.increasedContrast[theme][family];
      if (anchor) value.splice(0, 3, ...anchor);
    }
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
  return { theme, contrast, roles, resolve, background: resolve('bg-primary').slice(0, 3) };
}
