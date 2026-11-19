import profile from './text-styles.json' with { type: 'json' };

/** Resolve authored text references for JS and native generators alike. */
export function resolveTextStyles(value) {
  if (Array.isArray(value)) return value.map(resolveTextStyles);
  if (value === null || typeof value !== 'object') return value;
  const { $textStyle: role, ...properties } = value;
  const resolved = Object.fromEntries(
    Object.entries(properties).map(([key, child]) => [key, resolveTextStyles(child)]),
  );
  if (role === undefined) return resolved;
  const style = profile.roles[role];
  if (!style) throw new Error(`Unknown authored text style: ${role}`);
  const metrics = Object.fromEntries(
    ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing'].map((key) => [key, style[key]]),
  );
  for (const key of Object.keys(metrics)) {
    if (key in resolved) throw new Error(`Text style ${role} must not override ${key}`);
  }
  return { ...resolved, ...metrics };
}
