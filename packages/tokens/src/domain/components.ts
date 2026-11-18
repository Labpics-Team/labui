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
  for (const [component, definition] of Object.entries({ button: profile.button })) {
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
  for (const [size, metrics] of Object.entries(profile.input.sizes)) {
    const name = `input-${size}`;
    dimension('size', name, metrics.height);
    dimension('size', `${name}-content`, metrics.contentHeight);
    dimension('radius', name, metrics.radius);
    dimension('space', `${name}-x`, metrics.paddingX);
    dimension('space', `${name}-y`, metrics.paddingY);
    dimension('font-size', name, metrics.fontSize);
    scalar('font-weight', name, metrics.fontWeight);
    scalar('line-height', name, metrics.lineHeight / metrics.fontSize);
    scalar(
      'letter-spacing',
      name,
      metrics.letterSpacing / metrics.fontSize,
      `${num(metrics.letterSpacing / metrics.fontSize, 6)}em`,
    );
  }
  const label = profile.input.label;
  dimension('font-size', 'input-label', label.fontSize);
  scalar('font-weight', 'input-label', label.fontWeight);
  scalar('line-height', 'input-label', label.lineHeight / label.fontSize);
  dimension('space', 'input-label-x', label.paddingX);
  dimension('space', 'input-label-overhang', label.overhang);
  dimension('space', 'input-helper-gap', profile.input.helper.gap);
  dimension('space', 'input-helper-x', profile.input.helper.paddingX);
  dimension('stroke', 'input', profile.input.strokeWidth);
  dimension('size', 'input-adornment', profile.input.adornment.width);
  dimension('size', 'input-icon', profile.input.adornment.iconSize);
  dimension('space', 'input-adornment-outer', profile.input.adornment.paddingOuter);
  dimension('space', 'input-adornment-inner', profile.input.adornment.paddingInner);
  dimension('size', 'textarea', profile.textarea.height);
  dimension('font-size', 'textarea-label', profile.textarea.labelFontSize);
  dimension('line-height', 'textarea-label', profile.textarea.labelLineHeight);
  dimension('space', 'textarea-top', profile.textarea.paddingTop);
  dimension('space', 'textarea-bottom', profile.textarea.paddingBottom);
  dimension('space', 'textarea-start', profile.textarea.paddingStart);
  dimension('space', 'textarea-end', profile.textarea.paddingEnd);
  dimension('radius', 'card-surface', profile.card.radius);
  dimension('space', 'card-padding', profile.card.padding);
  dimension('space', 'card-gap', profile.card.gap);
  scalar('shape', 'card-smoothing', profile.card.cornerSmoothing);
  dimension('stroke', 'card', profile.card.strokeWidth);
  dimension('size', 'card-media', profile.card.mediaHeight);
  dimension('space', 'card-caption-gap', profile.card.captionGap);
  dimension('space', 'card-text-gap', profile.card.textGap);
  dimension('space', 'card-title-gap', profile.card.titleGap);
  for (const [family, textRoles] of Object.entries({
    card: profile.card.text,
    sheet: profile.sheet.typography,
  })) {
    for (const [role, text] of Object.entries(textRoles)) {
      const name = `${family}-${role}`;
      dimension('font-size', name, text.fontSize);
      dimension('line-height', name, text.lineHeight);
      scalar('font-weight', name, text.fontWeight);
      scalar(
        'letter-spacing',
        name,
        text.letterSpacing / text.fontSize,
        `${num(text.letterSpacing / text.fontSize, 6)}em`,
      );
    }
  }
  dimension('radius', 'sheet-top', profile.sheet.topRadius);
  dimension('space', 'sheet-x', profile.sheet.paddingX);
  dimension('space', 'sheet-bottom', profile.sheet.paddingBottom);
  dimension('space', 'sheet-content-gap', profile.sheet.contentGap);
  dimension('space', 'sheet-header-gap', profile.sheet.headerGap);
  dimension('size', 'sheet-drag-area', profile.sheet.drag.areaHeight);
  dimension('size', 'sheet-drag-width', profile.sheet.drag.width);
  dimension('size', 'sheet-drag-height', profile.sheet.drag.height);
  dimension('radius', 'sheet-drag', profile.sheet.drag.radius);
  dimension('space', 'sheet-drag-top', profile.sheet.drag.top);
  dimension('space', 'sheet-drag-center-offset', profile.sheet.drag.centerOffset);
  for (const [position, height] of Object.entries(profile.sheet.bodyHeights))
    dimension('size', `sheet-body-${position}`, height);
  const snackbar = profile.snackbar;
  dimension('radius', 'snackbar', snackbar.radius);
  dimension('space', 'snackbar-start', snackbar.paddingStart);
  dimension('space', 'snackbar-end', snackbar.paddingEnd);
  dimension('space', 'snackbar-y', snackbar.paddingY);
  dimension('space', 'snackbar-action-gap', snackbar.actionGap);
  dimension('space', 'snackbar-label-gap', snackbar.labelGap);
  dimension('font-size', 'snackbar', snackbar.fontSize);
  scalar('font-weight', 'snackbar', snackbar.fontWeight);
  scalar('line-height', 'snackbar', snackbar.lineHeight / snackbar.fontSize);
  dimension('stroke', 'snackbar', snackbar.strokeWidth);
  dimension('size', 'snackbar-timer', snackbar.timer.size);
  const badge = profile.badge;
  dimension('size', 'badge', badge.height);
  dimension('size', 'badge-icon', badge.iconSize);
  dimension('radius', 'badge', badge.radius);
  dimension('space', 'badge-x', badge.paddingX);
  dimension('space', 'badge-y', badge.paddingY);
  dimension('space', 'badge-gap', badge.gap);
  dimension('font-size', 'badge', badge.fontSize);
  scalar('font-weight', 'badge', badge.fontWeight);
  scalar('line-height', 'badge', badge.lineHeight / badge.fontSize);
  scalar(
    'letter-spacing',
    'badge',
    badge.letterSpacing / badge.fontSize,
    `${badge.letterSpacing / badge.fontSize}em`,
  );
  return result;
}
