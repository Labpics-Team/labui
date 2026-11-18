import source from './profile.json' with { type: 'json' };

/** Serializable authoring profile shared by web and native generators.
 * Colours and opacity belong to Colors; these are role references, never copies.
 * Dimensions are Figma logical units. Shape and renderer conversions are separate.
 */
export const materialProfile = source;
export type MaterialTier = keyof typeof source.tiers;
export type ThemeName = keyof typeof source.paints.blendMode;
export type MaterialBlendMode = 'color-dodge' | 'overlay';
export const MATERIAL_TIERS = Object.keys(source.tiers) as MaterialTier[];

export function materialRoles(tier: MaterialTier): {
  normal: string;
  blend: string;
  solid: string;
} {
  return {
    normal: source.paints.normalRole.replace('{tier}', tier),
    blend: source.paints.blendRole.replace('{tier}', tier),
    solid: source.tiers[tier].solidRole,
  };
}

/** Figma getCSSAsync gives blur(radius / 2) for BACKGROUND_BLUR.
 * Glass frost is a distinct authoring field, with its own renderer mapping.
 */
export function webBackdropBlur(tier: MaterialTier): number {
  return source.tiers[tier].backdrop.radius / 2;
}

/** Calibrated against the untouched Figma Effects/Glass dot-pattern scene. */
export function webGlassFrost(tier: MaterialTier): number {
  return source.tiers[tier].glass.frost / 2;
}

export function materialBlendMode(theme: ThemeName): MaterialBlendMode {
  return source.paints.blendMode[theme] as MaterialBlendMode;
}
