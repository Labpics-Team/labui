# ADR-0008. Материалов три: снос blur-яруса (solid / glass / acrylic)

Статус: принято (вердикт владельца, 2026-07-09). Номер 0007 занят открытым
PR «elevation contract» — здесь намеренно 0008, без пересечения тем.

## Контекст

Ось `data-material` несла четыре моды: `solid`, `glass`, `blur`, `acrylic`.

- `glass` — refraction: тонкий полупрозрачный tier над живым фоном,
  `blur(48px)`, specular rim (ADR-0003).
- `blur` — «heavy frost»: тот же живой фон, но `blur(128px)`, без рима,
  без зерна.
- `acrylic` — diffusion уровня Fluent: `blur(48px)` + `saturate(180%)`
  + tint + запечённое ~2% зерно (ADR-0004).

Вердикт владельца: **acrylic и blur перцептивно дублируют друг друга** —
на реальных подложках разница радиуса за порогом различимости, а зерно и
насыщение acrylic читаются как «тот же фрост, но дороже». Два неразличимых
режима в публичной оси — ложный выбор: потребитель не может осознанно
выбрать между ними, а матрицы гарантий (byte-golden: моды × tiers × темы)
оплачивают четвёртую моду полной строкой.

## Решение

Ярус `blur` снесён целиком, материалов ровно три: `solid / glass / acrylic`.

1. Тип `MaterialMode` и `LIVE_BLUR_MODES` больше не знают `blur`
   (`packages/core/src/theme.ts`, `packages/materials/src/material-guarantee.ts`).
2. Все CSS-блоки `[data-material="blur"]` удалены из `material.css`,
   включая деградации и `--lensed`-ребинды.
3. Демки, доки и тесты переведены на трёхмодовую ось; сравнение радиусов
   glass↔blur из Playwright-сьюта удалено.
4. **Регрессионный замок**: `degradations.test.ts` утверждает
   `not.toContain('[data-material="blur"]')` по собранному CSS — возврат
   яруса возможен только осознанной правкой этого закона.

Миграция потребителей: `data-material="blur"` → `data-material="acrylic"`
(ближайший перцептивный сосед; неизвестные значения оси и раньше падали
в `solid`-канон по default-ветке).

## Последствия

- Комбинаторика гарантий сократилась на четверть: 3 моды × 5 tiers × темы;
  byte-composite golden-матрицы пересчитаны.
- Один live-blur-бюджет на страницу проще объяснять: пара glass/acrylic —
  «refraction против diffusion», без третьего «просто сильнее размыто».
- ADR-0004 остаётся каноном acrylic без изменений; specular-rim закон
  (glass/acrylic — on, solid — off) стал бинарным.
- Ломающее изменение для внешних потребителей типа `MaterialMode`
  зафиксировано в changeset (`three-materials-blur-removal`).
