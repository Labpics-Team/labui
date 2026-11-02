export function themeVars(
  css: string,
  theme: 'light' | 'dark',
  contrast?: 'normal' | 'more',
): Map<string, string>;

export function resolveValue(
  name: string,
  vars: ReadonlyMap<string, string>,
  seen?: Set<string>,
): string;
