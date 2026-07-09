---
"@labpics/ui-materials": patch
---

Acrylic v2.1 (ADR-0009): корректный регион фильтра + общий движковый примитив +
развязка acrylic от glass-модуля. Acrylic-фильтр — per-surface (`registry` +
uid), `filterUnits="userSpaceOnUse"`, регион по реальному боксу
(`offsetWidth/Height`) + изотропный охват 2σ, держится ResizeObserver. Это чинит
класс-дефект прежнего процентного региона (`objectBoundingBox −25%/150%` давал
недобор блюра по короткой оси вытянутых поверхностей — навбар/док). DRY/Clean/
SOLID: новый `engine/mount.ts` несёт общий `ensureHiddenDefs` (был двумя
копиями), `trailingRaf` (тремя), `supportsBackdropFilterUrl` (общая проба) и порт
`EngineBinding` + `mountEngine` — `runtime.ts` из трёх дословных sync-блоков стал
массивом bindings + один оркестратор (OCP). Acrylic БОЛЬШЕ НЕ зависит от
liquid-glass-модуля: анатомия материалов разная (диффузия+зажим vs рефракция+
линза), разделяется только механика SVG-фильтра в DOM, не эффект. Линза
liquid-glass после миграции defs — байт-в-байт (VRT-гейт зелёный). Публичный
API пакета не изменён. Перф: бенч показал, что стоимость backdrop-filter целиком
на GPU (main ≈0) и GPU не насыщается 32 фильтрами (240 FPS) — «×2 везде» нет;
реальная победа на больших поверхностях (~1.6× меньше пикселей блюра через
регион). Числа — `packages/materials/bench/BASELINE.md`.
