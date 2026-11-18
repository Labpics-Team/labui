# Тени LabUI

`@labpics/ui-shadow/profile.json` и экспорт `shadowProfile` сериализуют те же
`ELEVATION_SHAPES`, `SHADOW_SLOTS` и `SLOT_ALPHA`, из которых строится CSS.
Каждый уровень содержит полный упорядоченный стек `{x,y,blur,spread,colorRole,opacity}`.
Размеры — logical Figma px; `blur` означает авторский/CSS radius, не sigma.
`colorRole` ссылается на Colors `bg-static-dark`. `lightAngle` поворачивает
исходный вертикальный сдвиг, `roles` связывает семантические имена с размерами.
Native применяет тот же `darkAlphaMultiplier`; отдельной таблицы теней нет.
