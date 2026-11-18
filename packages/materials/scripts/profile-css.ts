import {
  MATERIAL_TIERS,
  type MaterialTier,
  materialProfile,
  materialRoles,
  webBackdropBlur,
  webGlassFrost,
} from '../src/profile';
import { acrylicNoiseDataUri } from './build-acrylic-noise';

/** Renderer conversion, kept out of the platform-neutral authoring document. */
export function materialProfileCss(): string {
  const declarations = (tier: MaterialTier): string => {
    const roles = materialRoles(tier);
    const glass = materialProfile.tiers[tier].glass;
    return [
      `  --_tint: var(--lab-${roles.normal});`,
      `  --_blend: var(--lab-${roles.blend});`,
      `  --_solid: var(--lab-${roles.solid});`,
      `  --_first-paint: var(--_lab-material-${tier}-fill);`,
      `  --_first-paint-filter: var(--_lab-material-${tier}-filter);`,
      `  --_backdrop-blur: ${webBackdropBlur(tier)}px;`,
      `  --_glass-frost: ${webGlassFrost(tier)}px;`,
      `  --_lg-refraction: ${glass.refraction};`,
      `  --_lg-depth: ${glass.depth};`,
      `  --_lg-dispersion: ${glass.dispersion};`,
      `  --_glass-rim: linear-gradient(${180 + glass.lightAngle}deg, color-mix(in srgb, transparent, var(--lab-bg-static-light) ${glass.lightIntensity * 100}%), transparent);`,
    ].join('\n');
  };
  const sheet = materialProfile.compositions.sheet;
  return [
    '/* Generated from src/profile.json. Glass frost is a separate renderer mapping. */',
    firstPaintCss(),
    `:root { --lab-sheet-ghost-overlap: ${sheet.ghost.overlap}px; }`,
    `[data-veil][data-veil-profile],.lab-material-ghost--sheet { --_veil-noise: ${acrylicNoiseDataUri(materialProfile.progressive.styles.strong.noiseOpacity)}; --_veil-noise-size: ${Number((48 * materialProfile.noise.size).toFixed(4))}px; --_veil-noise-blend: ${materialProfile.noise.blendMode}; }`,
    `.lab-material {\n${declarations('base')}\n}`,
    ...MATERIAL_TIERS.map((tier) => `.lab-material--${tier} {\n${declarations(tier)}\n}`),
    `.lab-material--sheet {\n${declarations(sheet.body.tier as MaterialTier)}\n  box-shadow: var(--lab-elevation-${sheet.body.shadow});\n  outline: ${sheet.body.stroke.width}px solid var(--lab-${sheet.body.stroke.role});\n  outline-offset: 0;\n}`,
    `.lab-material-ghost--sheet {\n  --_veil-profile: ${sheet.ghost.profile};\n  --_veil-direction: ${sheet.ghost.direction};\n}`,
    `.lab-material-ghost--sheet > [data-veil-paint] { background: var(--lab-${sheet.ghost.paintRole}); }`,
  ].join('\n');
}
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseRgb } from '../src/luminance';
import type { Rgba } from '../src/luminance';
import { compileMaterialTheme } from '../src/material-theme';

/** Build-time consumer of Colors' generated contract: authored roles stay in
 * Colors, while compositing and its browser fallback stay in Materials.
 */
function firstPaintCss(): string {
  const colors = readFileSync(
    createRequire(import.meta.url).resolve('@labui/colors/contract.css'),
    'utf8',
  );
  const dark = colors.indexOf('[data-theme="dark"]');
  const media = colors.indexOf('@media', dark);
  if (dark < 0) throw new Error('Colors contract is missing its dark theme');
  const themes = {
    light: colors.slice(0, dark),
    dark: colors.slice(dark, media < 0 ? undefined : media),
  };
  const blocks = Object.entries(themes).map(([theme, section]) => {
    const values: Record<string, Rgba> = {};
    for (const tier of MATERIAL_TIERS) {
      const roles = materialRoles(tier);
      const read = (name: string) => {
        const value = section.match(new RegExp(`--lab-${name}\\s*:\\s*([^;]+);`))?.[1];
        const color = value ? parseRgb(value) : null;
        if (!color) throw new Error(`Missing generated material paint ${theme}/${name}`);
        return color;
      };
      values[roles.normal] = read(roles.normal);
      values[roles.blend] = read(roles.blend);
    }
    const declarations = Object.entries(compileMaterialTheme(theme as 'light' | 'dark', values))
      .map(([key, value]) => `  ${key}:${value};`)
      .join('\n');
    return { theme, declarations };
  });
  const light = blocks.find((x) => x.theme === 'light')?.declarations;
  const darkValues = blocks.find((x) => x.theme === 'dark')?.declarations;
  return `:root,[data-theme="light"]{\n${light}\n}\n[data-theme="dark"]{\n${darkValues}\n}\n@media(prefers-color-scheme:dark){:root:not([data-theme]){\n${darkValues}\n}}`;
}
