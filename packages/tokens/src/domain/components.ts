import profile from '../components.json' with { type: 'json' };
import { num } from './format.js';
import type { ResolvedToken, ScaleKind } from './token.js';

/** Component geometry is shared with native; only this projection knows CSS units. */
export function buildComponentTokens(): ResolvedToken[] {
  const result: ResolvedToken[] = [];
  const dimension = (kind: ScaleKind, name: string, px: number) => {
    result.push({ kind, name, numeric: px, cssValue: `${num(px / 16)}rem`, dtcgType: 'dimension' });
  };
  const scalar = (kind: ScaleKind, name: string, value: number, cssValue = num(value)) => {
    result.push({ kind, name, numeric: value, cssValue, dtcgType: 'number' });
  };
  for (const [component, definition] of Object.entries(profile)) {
    scalar('font-weight', component, definition.fontWeight);
    dimension('space', `${component}-label-x`, definition.labelPaddingX);
    dimension('space', `${component}-label-gap`, definition.labelGap);
    scalar(
      'state',
      `${component}-description-opacity`,
      definition.descriptionOpacity,
      `${num(definition.descriptionOpacity * 100)}%`,
    );
    for (const [size, metrics] of Object.entries(definition.sizes)) {
      const name = `${component}-${size}`;
      dimension('size', name, metrics.height);
      dimension('size', `${name}-icon`, metrics.icon);
      dimension('radius', name, metrics.radius);
      dimension('space', `${name}-x`, metrics.paddingX);
      dimension('space', `${name}-y`, metrics.paddingY);
      dimension('font-size', name, metrics.fontSize);
      scalar('line-height', name, metrics.lineHeight / metrics.fontSize);
      scalar('font-weight', `${name}-description`, metrics.descriptionFontWeight);
      scalar(
        'letter-spacing',
        `${name}-description`,
        metrics.descriptionLetterSpacing / metrics.fontSize,
        `${num(metrics.descriptionLetterSpacing / metrics.fontSize, 6)}em`,
      );
      scalar(
        'state',
        `${name}-description-accent-plain-opacity`,
        metrics.descriptionAccentPlainOpacity,
        `${num(metrics.descriptionAccentPlainOpacity * 100)}%`,
      );
      scalar(
        'letter-spacing',
        name,
        metrics.letterSpacing / metrics.fontSize,
        `${num(metrics.letterSpacing / metrics.fontSize)}em`,
      );
    }
    for (const [key, value] of Object.entries(definition.fill)) {
      const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      scalar('state', `${component}-${name}`, value, `${num(value * 100)}%`);
    }
    for (const [key, value] of Object.entries(definition.innerShadow)) {
      dimension('space', `${component}-inner-${key}`, value);
    }
  }
  return result;
}
