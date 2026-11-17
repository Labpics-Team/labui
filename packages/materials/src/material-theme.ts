import type { Rgba } from './luminance';
import { compileMaterialPaint } from './material-paints';
import {
  MATERIAL_TIERS,
  type MaterialTier,
  type ThemeName,
  materialBlendMode,
  materialRoles,
} from './profile';

export type MaterialRoleMap = Readonly<Record<string, Rgba | undefined>>;
export type MaterialThemeStyle = Readonly<
  Record<`--_lab-material-${MaterialTier}-${'fill' | 'filter'}`, string>
>;

/** Compile a theme's numeric Colors roles for its first SSR frame. This pure
 * function shares the same transfer compiler as the mounted renderer; it needs
 * no DOM or solver. Apply the result to the same scope as the source role CSS.
 * Role keys omit the CSS --lab- prefix; rgb channels are encoded sRGB bytes.
 */
export function compileMaterialTheme(theme: ThemeName, roles: MaterialRoleMap): MaterialThemeStyle {
  const read = (name: string): Rgba => {
    const value = roles[name];
    if (
      !value ||
      ![value.r, value.g, value.b].every(
        (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255,
      ) ||
      !Number.isFinite(value.a) ||
      value.a < 0 ||
      value.a > 1
    ) {
      throw new TypeError(`Material role ${name} must contain RGB channels 0..255 and alpha 0..1`);
    }
    return value;
  };
  const styles: Partial<Record<keyof MaterialThemeStyle, string>> = {};
  for (const tier of MATERIAL_TIERS) {
    const names = materialRoles(tier);
    const compiled = compileMaterialPaint({
      normal: read(names.normal),
      blend: read(names.blend),
      blendMode: materialBlendMode(theme),
    });
    const f = compiled.fill;
    const n = (value: number) => Number(value.toFixed(8));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><filter id="p" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feComponentTransfer>${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="table" tableValues="${compiled.tables[i]}"/>`).join('')}<feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter></svg>`;
    styles[`--_lab-material-${tier}-fill`] = `rgb(${n(f.r)} ${n(f.g)} ${n(f.b)} / ${n(f.a)})`;
    styles[`--_lab-material-${tier}-filter`] = compiled.affine
      ? 'opacity(1)'
      : `url("data:image/svg+xml,${encodeURIComponent(svg)}#p")`;
  }
  return Object.freeze(styles) as MaterialThemeStyle;
}
