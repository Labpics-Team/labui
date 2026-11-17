import {
  MATERIAL_TIERS,
  type MaterialTier,
  materialBlendMode,
  materialProfile,
  materialRoles,
  webBackdropBlur,
  webGlassFrost,
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
  return [
    '/* Generated from src/profile.json. Glass frost is a separate renderer mapping. */',
    firstPaintCss(),
    `[data-veil][data-veil-profile] { --_veil-noise: url("./veil-noise.png"); --_veil-noise-size: ${Number((48 * materialProfile.noise.size).toFixed(4))}px; --_veil-noise-blend: ${materialProfile.noise.blendMode}; }`,
    `.lab-material {\n${declarations('base')}\n}`,
    ...MATERIAL_TIERS.map((tier) => `.lab-material--${tier} {\n${declarations(tier)}\n}`),
  ].join('\n');
}
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseRgb } from '../src/luminance';
import { compileMaterialPaint } from '../src/material-paints';

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
    const declarations = MATERIAL_TIERS.flatMap((tier) => {
      const roles = materialRoles(tier);
      const read = (name: string) => {
        const value = section.match(new RegExp(`--lab-${name}\\s*:\\s*([^;]+);`))?.[1];
        const color = value ? parseRgb(value) : null;
        if (!color) throw new Error(`Missing generated material paint ${theme}/${name}`);
        return color;
      };
      const compiled = compileMaterialPaint({
        normal: read(roles.normal),
        blend: read(roles.blend),
        blendMode: materialBlendMode(theme as 'light' | 'dark'),
      });
      const f = compiled.fill;
      const number = (value: number) => Number(value.toFixed(8));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><filter id="p" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feComponentTransfer>${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="table" tableValues="${compiled.tables[i]}"/>`).join('')}<feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter></svg>`;
      return [
        `  --_lab-material-${tier}-fill:rgb(${number(f.r)} ${number(f.g)} ${number(f.b)} / ${number(f.a)});`,
        `  --_lab-material-${tier}-filter:${compiled.affine ? 'opacity(1)' : `url("data:image/svg+xml,${encodeURIComponent(svg)}#p")`};`,
      ];
    }).join('\n');
    return { theme, declarations };
  });
  const light = blocks.find((x) => x.theme === 'light')?.declarations;
  const darkValues = blocks.find((x) => x.theme === 'dark')?.declarations;
  return `:root,[data-theme="light"]{\n${light}\n}\n[data-theme="dark"]{\n${darkValues}\n}\n@media(prefers-color-scheme:dark){:root:not([data-theme]){\n${darkValues}\n}}`;
}
