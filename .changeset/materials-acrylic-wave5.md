---
"@labpics/ui-materials": minor
"@labpics/ui-docs": patch
---

Волна 5 — материал **Acrylic** (Fluent-класс) рядом с Liquid Glass + политика фонов
и честная деградация (ADR-0004 Решение 1, ADR-0002 §1 волна 3).

- **Ось `data-material` расширена значением `acrylic`** (`MaterialMode`, `material.css`,
  демо-контрол). Рецепт — рассеяние (диффузный блюр), не рефракция стекла:
  `blur(48px)` + `saturate(180%)` (ПЕРЕИСПОЛЬЗУЮТ `--_blur-glass` / `--_saturate-on`,
  без новых величин) + straight-alpha тинт + запечённое зерно **~2%**. Тинт и коридор
  те же, что у glass → α-граница-гарантия acrylic тождественна glass (ни одной новой
  unguaranteed-пары; множитель сжатия `C` не измерен — ADR-0004 Решение 2).
- **Зерно** — data-URI PNG одной генерации (не рантайм-фильтр), детерминированный
  генератор `scripts/build-acrylic-noise.ts` (фикс-сид, PNG-энкодер на `node:zlib`,
  без бинаря в git), инлайн в `material.css`, гейт `check-generated` + декод-тест ассета.
- **Политика фонов** (`background-policy.ts`, публичный API): `isLiveBlur`,
  `canNest` (запрет вложенного live-блюра), `LIVE_BLUR_MODES`, `MATERIAL_FILL_FAMILY`
  (`--lab-bg-material-*` — единственное семейство собственной заливки материала);
  запечатано скан-тестом `material.css` и обобщённым e2e-инвариантом вложенности.
- **Честная деградация**: все 4 деградации (нет backdrop-filter /
  prefers-reduced-transparency / prefers-contrast:more / forced-colors) расширены на
  acrylic → непрозрачный solid-канон той же целевой точки, зерно снимается.
- **e2e materials-flag** расширен (chromium+webkit): acrylic-флип (live-блюр+saturate+
  зерно), деградация, инвариант вложенности по всем live-модам. Чтение цвета
  мигрировано на `support/color.ts` (`normalizeCssColor`) — закрыт долг PR #101
  (хрупкость `parse()` к oklch), без третьего парсера.
