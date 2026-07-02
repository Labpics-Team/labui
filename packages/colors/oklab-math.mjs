// ЕДИНСТВЕННАЯ labui-копия Oklab-математики — дословно из движка
// (crates/labcolors-core/src/spaces/oklab.rs, srgb.rs). Потребители: золотая
// сверка (реконструкция oklch → байты) и генератор контракта (движение
// заливки к полу). Дубликат этих матриц где-либо ещё = дрейф истины.

export const M_OKLAB_LMS = [
  [1.0, 0.3963377774, 0.2158037573],
  [1.0, -0.1055613458, -0.0638541728],
  [1.0, -0.0894841775, -1.291485548],
];
export const M_LMS_SRGB = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
export const M_SRGB_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
export const M_LMS_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

export const mulv = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
export const gam = (v) => (v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v);
export const degam = (v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);

export const hexToLin = (h) => {
  const n = Number.parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => degam(c / 255));
};
export const linToHex = (lin) => {
  const b = lin.map((v) => Math.min(255, Math.max(0, Math.round(gam(v) * 255))));
  return `#${b.map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};
export const oklabOf = (lin) => mulv(M_LMS_OKLAB, mulv(M_SRGB_LMS, lin).map(Math.cbrt));
export const linOf = (lab) =>
  mulv(
    M_LMS_SRGB,
    mulv(M_OKLAB_LMS, lab).map((x) => x ** 3),
  );
/** WCAG-люминанс линейного sRGB. */
export const wcagY = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
