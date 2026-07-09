/*
 * Коридор acrylic v2 — luminosity-зажим как МАТЕМАТИКА гарантии (ADR-0009).
 *
 * Рецепт acrylic v2 кладёт внутрь backdrop-filter SVG-цепочку
 * blur → saturate → feFlood(тинт) → feBlend mode="luminosity" — то есть до
 * тинт-композита яркость живого фона ЗАЖИМАЕТСЯ к blend-луме тинта с силой
 * αf = альфа_flood × flood-opacity. Этот модуль выводит, во что зажим
 * превращает достижимую полосу фона, — и отдаёт её в evaluateTier тем же
 * `BackdropCorridor`, которым ADR-0004 (Решение 2) параметризовал гарантию.
 * Так закрывается долг ADR-0004 «множитель сжатия C требует измерения»:
 * сжатие ВЫВОДИТСЯ из формулы смеси, а не мерится по фотографиям.
 *
 * ── Простр-во счёта ─────────────────────────────────────────────────────────
 * Фильтр объявляется с color-interpolation-filters="sRGB", поэтому feBlend
 * считает на ГАММА-кодированных каналах — в том же пространстве, где красит
 * CSS-смесь и где живёт весь compositeOver-стек пакета. Blend-лума спеки
 * (W3C Compositing & Blending §Non-separable: Lum(C) = .3R + .59G + .11B)
 * — это НЕ WCAG relative luminance (у той другие веса и линеаризация);
 * здесь она зовётся blendLuma, чтобы её нельзя было перепутать.
 *
 * ── Внешний бокс (направление отказа — только расширить) ────────────────────
 * Пиксель после смеси: C' = αf·Q + (1−αf)·Cb, где Q = ClipColor(SetLum(Cb, Lf))
 * — КАКОЙ-ТО цвет с blendLuma ровно Lf и каналами в [0,1]. Канал ch любого
 * цвета с лумой Lf лежит в жёстких пределах
 *     q_hi = min(1, Lf / w_ch)                — вся лума на одном канале;
 *     q_lo = max(0, (Lf − (1 − w_ch)) / w_ch) — остальные каналы упёрлись в 1.
 * Cb пробегает [0,1]. Значит бокс
 *     [αf·q_lo, αf·q_hi + (1−αf)]  по каждому каналу
 * накрывает C' над ЛЮБЫМ фоном — внешняя граница, гарантия не переобещает
 * (то же направление отказа, что у cornerCorridor). Blur-ступень рецепта —
 * усреднение (выпуклая комбинация), saturate в sRGB-режиме клампится в куб:
 * обе оставляют вход смеси внутри [0,1]³, посылка бокса держится.
 *
 * Честное ограничение: бокс кодирует ТОЛЬКО пер-канальные следствия лумы, без
 * связки каналов. На крайне-светлых и крайне-тёмных flood (наши нейтральные
 * тинты контракта) связка почти не теряется и сжатие сильное; на средней луме
 * бокс деградирует к широкому — то есть К КОНСЕРВАТИВНОМУ, не к переобещанию.
 * property-тест держит бокс над точной симуляцией смеси на всём кубе.
 */

import type { Rgba } from './luminance';
import type { BackdropCorridor } from './material-guarantee';

/** Веса blend-лумы спеки W3C Compositing (§Non-separable blend modes). */
const LUM_W = { r: 0.3, g: 0.59, b: 0.11 } as const;

const SRGB_MAX = 255;

/**
 * Сила luminosity-слоя (flood-opacity в фильтре) — аналог TintLuminosityOpacity
 * кисти WinUI AcrylicBrush. PROVENANCE: DECLARED-размен `kind: declared-tradeoff`,
 * визуально откалиброван владельцем на интерактивном демо трёх рецептов
 * (2026-07-09; скриншоты в PR). Эффективная сила зажима ДЕРИВИРУЕТСЯ дальше:
 * αf = альфа тинт-токена контракта × эта константа — прозрачный (sheer) tier
 * зажимает слабее плотного сам собой, ноль новых значений на tier.
 * Рычаг гарантии: если пара не добирает пол, повышение этой константы сужает
 * коридор (см. голден гарантированных пар).
 */
export const ACRYLIC_LUMINOSITY_OPACITY = 0.7;

/** Blend-лума W3C на гамма-кодированных каналах, 0..1 (НЕ WCAG-люминанс). */
export function blendLuma(colour: Rgba): number {
  return (LUM_W.r * colour.r + LUM_W.g * colour.g + LUM_W.b * colour.b) / SRGB_MAX;
}

/** ClipColor спеки: вернуть цвет в [0,1]³, сохранив его блендовую луму. */
function clipColor(c: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const l = LUM_W.r * c.r + LUM_W.g * c.g + LUM_W.b * c.b;
  const n = Math.min(c.r, c.g, c.b);
  const x = Math.max(c.r, c.g, c.b);
  let { r, g, b } = c;
  if (n < 0) {
    const scale = l / (l - n); // l−n > 0: n < 0 ≤ l (лума неотрицательных весов)
    r = l + (r - l) * scale;
    g = l + (g - l) * scale;
    b = l + (b - l) * scale;
  }
  if (x > 1) {
    const denom = x - l;
    if (denom > 0) {
      const scale = (1 - l) / denom;
      r = l + (r - l) * scale;
      g = l + (g - l) * scale;
      b = l + (b - l) * scale;
    }
  }
  return { r, g, b };
}

/**
 * ТОЧНАЯ пер-пиксельная симуляция luminosity-смеси фильтра по W3C Compositing:
 * B = ClipColor(SetLum(Cb, Lum(Cs))), затем композит источника с эффективной
 * альфой αf = flood.a × floodOpacity над непрозрачным фоном:
 * C' = αf·B + (1−αf)·Cb. Каналы 0..255 непрерывные (квантизация — забота
 * байт-слоя, как в compositeOver). Используется property-тестом (бокс обязан
 * её накрывать) и браузерным дифференциалом (симуляция ↔ реальный композитор).
 */
export function luminosityBlend(backdrop: Rgba, flood: Rgba, floodOpacity: number): Rgba {
  const alpha = Math.min(1, Math.max(0, flood.a * floodOpacity));
  const cb = { r: backdrop.r / SRGB_MAX, g: backdrop.g / SRGB_MAX, b: backdrop.b / SRGB_MAX };
  const lumFlood = blendLuma(flood);
  const d = lumFlood - (LUM_W.r * cb.r + LUM_W.g * cb.g + LUM_W.b * cb.b);
  const blended = clipColor({ r: cb.r + d, g: cb.g + d, b: cb.b + d });
  return {
    r: (alpha * blended.r + (1 - alpha) * cb.r) * SRGB_MAX,
    g: (alpha * blended.g + (1 - alpha) * cb.g) * SRGB_MAX,
    b: (alpha * blended.b + (1 - alpha) * cb.b) * SRGB_MAX,
    a: 1,
  };
}

/**
 * Внешний пер-канальный бокс достижимых цветов ПОСЛЕ luminosity-зажима — тот
 * самый `BackdropCorridor`, который evaluateTier принимает вместо полного
 * [чёрный, белый]. αf = flood.a × floodOpacity; αf = 0 вырождается ровно в
 * полный коридор (нет зажима — нет сжатия), αf = 1 у экстремальной лумы
 * схлопывает полосу в точку.
 */
export function acrylicCorridor(flood: Rgba, floodOpacity: number): BackdropCorridor {
  const alpha = Math.min(1, Math.max(0, flood.a * floodOpacity));
  const lumFlood = blendLuma(flood);
  const channel = (w: number): { lo: number; hi: number } => {
    const qLo = Math.max(0, (lumFlood - (1 - w)) / w);
    const qHi = Math.min(1, lumFlood / w);
    return {
      lo: alpha * qLo * SRGB_MAX,
      hi: (alpha * qHi + (1 - alpha)) * SRGB_MAX,
    };
  };
  const r = channel(LUM_W.r);
  const g = channel(LUM_W.g);
  const b = channel(LUM_W.b);
  return {
    min: { r: r.lo, g: g.lo, b: b.lo, a: 1 },
    max: { r: r.hi, g: g.hi, b: b.hi, a: 1 },
  };
}
