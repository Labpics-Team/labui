import profile from '../text-styles.json' with { type: 'json' };
import { num } from './format.js';
import type { ResolvedToken } from './token.js';

/** Authored roles are complete styles, independent of the configurable fluid scale. */
export const authoredTextStyles = profile.roles;

/** Authored roles never share the configurable fluid scales' property namespace. */
export function textStyleCssVarName(role: string, property: string): string {
  return `--lab-text-${role}-${property}`;
}

export function buildTextStyleTokens(): ResolvedToken[] {
  return Object.entries(authoredTextStyles).flatMap(
    ([name, style]) =>
      [
        {
          kind: 'font-size',
          name,
          numeric: style.fontSize,
          cssValue: `${num(style.fontSize / 16)}rem`,
          dtcgType: 'dimension',
        },
        {
          kind: 'line-height',
          name,
          numeric: style.lineHeight,
          cssValue: `${num(style.lineHeight / 16)}rem`,
          dtcgType: 'dimension',
        },
        {
          kind: 'font-weight',
          name,
          numeric: style.fontWeight,
          cssValue: num(style.fontWeight),
          dtcgType: 'number',
        },
        {
          kind: 'letter-spacing',
          name,
          numeric: style.letterSpacing,
          cssValue: `${num(style.letterSpacing / 16, 8)}rem`,
          dtcgType: 'dimension',
        },
      ] satisfies ResolvedToken[],
  );
}
