---
"@labpics/ui-materials": minor
---

Acrylic v2 (ADR-0009): настоящая Fluent-анатомия. Движок `engine/acrylic.ts`
(Chromium, монтируется `mountMaterialRuntime()`) поднимает acrylic до полного
рецепта — luminosity-смесь ВНУТРИ backdrop-фильтра одним url()-конвейером
(`blur → saturate → feFlood(тинт tier) → feBlend luminosity`, sRGB); без
движка истиной остаётся CSS-фолбэк v1. Гарантия читаемости усилена ВЫВОДОМ:
luminosity-зажим сужает коридор фона (`acrylicCorridor`), пары light/soft и
dark/subtle становятся guaranteed (8/10). Новые экспорты:
`ACRYLIC_LUMINOSITY_OPACITY`, `acrylicCorridor`, `luminosityBlend`,
`blendLuma`, `bandOverCorridor`, `worstContrastOverBand`. Структура: исходник
разрезан на файлы-материалы `src/materials/*.css` (порядок = order.ts;
поставляемый `material.css` не меняется); зерно получило `image-set`
1x/2x/3x того же ассета (зерно в один физический пиксель на любом DPR);
живые материалы делят одну ступень размытия `--_blur-live: 48px`.
