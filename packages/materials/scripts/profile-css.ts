import {
  MATERIAL_TIERS,
  type MaterialTier,
  materialProfile,
  materialRoles,
  webBackdropBlur,
} from '../src/profile';

/** Renderer conversion, kept out of the platform-neutral authoring document. */
export function materialProfileCss(): string {
  const declarations = (tier: MaterialTier): string => {
    const roles = materialRoles(tier);
    const glass = materialProfile.tiers[tier].glass;
    return [
      `  --_tint: var(--lab-${roles.normal});`,
      `  --_blend: var(--lab-${roles.blend});`,
      `  --_solid: var(--lab-${roles.solid});`,
      `  --_backdrop-blur: ${webBackdropBlur(tier)}px;`,
      `  --_glass-frost: ${glass.frost}px;`,
      `  --_lg-refraction: ${glass.refraction};`,
      `  --_lg-depth: ${glass.depth};`,
      `  --_lg-dispersion: ${glass.dispersion};`,
      `  --_glass-rim: linear-gradient(${180 + glass.lightAngle}deg, color-mix(in srgb, transparent, var(--lab-bg-static-light) ${glass.lightIntensity * 100}%), transparent);`,
    ].join('\n');
  };
  return [
    '/* Generated from src/profile.json. Glass frost is a separate renderer mapping. */',
    `.lab-material {\n${declarations('base')}\n}`,
    ...MATERIAL_TIERS.map((tier) => `.lab-material--${tier} {\n${declarations(tier)}\n}`),
  ].join('\n');
}
