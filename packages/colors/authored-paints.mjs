import components from '@labpics/ui-tokens/components.json' with { type: 'json' };

/** Avatar tint is a palette role, independent of Badge paint and chosen per theme. */
export function authoredAvatarRoles(theme, contrast, source) {
  return Object.fromEntries(
    Object.values(components.avatar.colors).map(({ anchor, role }) => {
      const definition = source.anchors[anchor];
      const rgb =
        contrast === 'more' && definition.increased
          ? definition.increased[theme]
          : definition[theme];
      return [role, [...rgb, 1]];
    }),
  );
}

/** Figma's authored stack is resolved before Program compilation, once per theme.
 * The Color(gray) -> Difference(white) -> Dodge(gray) -> Burn(black) stack
 * has an exact two-valued result. W3C nonseparable Color uses 0.30/0.59/0.11
 * luminosity (not WCAG relative luminance). Screen tints text; Normal tints icons.
 * This transfers an author paint recipe; contrast selection remains in Colors.
 * https://www.w3.org/TR/compositing-1/#blendingnonseparable
 */
export function authoredBadgeRoles(theme, contrast, source) {
  const result = {};
  const { onFill, tinted } = source.authoredPaints;
  const anchor = (name) => {
    const value = source.anchors[name];
    const rgb = contrast === 'more' && value.increased ? value.increased[theme] : value[theme];
    return rgb.map((channel) => channel / 255);
  };
  const rgba = (rgb, opacity = 1) => [...rgb.map((value) => Math.round(value * 255)), opacity];
  const neutral = source.authoredPaints.neutral;
  result['badge-base-primary'] = rgba(anchor(neutral.primaryAnchor));
  result['badge-base-inverted'] = rgba(anchor(neutral.invertedAnchor));
  result['badge-base-secondary'] = rgba(
    anchor(neutral.secondaryAnchor),
    contrast === 'more' ? 1 : neutral.secondaryOpacity,
  );
  result['badge-base-tint'] = rgba(anchor(neutral.tintAnchor), neutral.tintOpacity);
  result['badge-base-disabled-fill'] = rgba(
    anchor(neutral.tintAnchor),
    neutral.disabledFillOpacity[contrast][theme],
  );
  result['badge-base-disabled-label'] = rgba(
    anchor(neutral.secondaryAnchor),
    neutral.disabledLabelOpacity[contrast][theme],
  );
  for (const [color, definition] of Object.entries(components.badge.colors)) {
    if (!definition.anchor) {
      for (const [suffix, role] of Object.entries({
        fill: definition.fill,
        'label-on': definition.label,
        'icon-on': definition.label,
        tint: definition.tint,
        label: definition.tintLabel,
      })) {
        result[`badge-${suffix}-${color}`] = `@${role}`;
      }
      continue;
    }
    const rgb = anchor(definition.anchor);
    const luminosity = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    const inverse = 1 - luminosity;
    const dodge = inverse === 0 ? 0 : Math.min(1, inverse / (1 - onFill.dodge));
    const base = dodge === 1 ? 1 : 0;
    const tint = onFill.tint;
    result[`badge-fill-${color}`] = rgba(rgb);
    result[`badge-tint-${color}`] = rgba(rgb, onFill.tint);
    result[`badge-label-on-${color}`] = rgba(rgb.map((value) => base + (1 - base) * value * tint));
    result[`badge-icon-on-${color}`] = rgba(rgb.map((value) => base * (1 - tint) + value * tint));
    const labelRgb = anchor(
      theme === 'light' && definition.lightLabelAnchor
        ? definition.lightLabelAnchor
        : definition.anchor,
    );
    const paint = tinted[theme];
    // Figma's Tinted stack applies a partially opaque linear burn/dodge to its base.
    result[`badge-label-${color}`] = rgba(
      labelRgb.map((value) => {
        const blend =
          paint.blend === 'linear-burn'
            ? Math.max(0, value + paint.gray - 1)
            : Math.min(1, value + paint.gray);
        return value * (1 - paint.opacity) + blend * paint.opacity;
      }),
    );
  }
  // Keep the established sentiment spellings usable while the new renderer
  // normalizes them. Existing --lab-badge-label-on-warning stays unchanged.
  return result;
}
