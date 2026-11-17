# Геометрия тени и независимый эталон

17 ноября 2026, Chromium 140, Firefox 141, WebKit 26, headless Windows.

`mountSurfaceShape` заменяет полный стек тени. Обычная `box-shadow` подавляется
inline `none !important`: прежний CSS-селектор проигрывал авторскому `#subject`,
и нативная тень рисовалась поверх SVG. `refresh()` сохраняет последнюю авторскую
inline-декларацию; `destroy()` возвращает её значение и priority, сохраняя
последующую запись автора. Это проверено для stylesheet/inline `!important`,
обычной inline-декларации и изменений с `refresh()` и без него.

Отдельно обнаружена ошибка нативной inset-тени Firefox 141. Для host 100×140,
`border-radius:0 100px 0 0; box-shadow:inset 0 0 0 40px red` внутренняя область
начинается в (40,40), имеет размер 20×60 и радиус TR 20×20: после вычитания
spread исходный радиус 60 уменьшается общим коэффициентом 20/60.
Firefox native оставляет белым (20,41) и закрашивает (40,41). Отдельные CSS- и
SVG-конструкции и production runtime дают обратное во всех трёх браузерах.

| Изображение | Результат |
|---|---|
| [Firefox native](firefox-asymmetric-native.png) | Ошибочная нативная внутренняя область |
| [Общий контур](firefox-asymmetric-contour.png) | Область 20×60, TR 20×20 |
| [Аналитический SVG](asymmetric-inset-reference.png) | Независимо заданные дуги совпадают с общим контуром |

Поэтому два asymmetric случая в `verify-surface-shape.mjs` используют во всех
браузерах отдельный CSS-пример: красный host с clipping по радиусу и белый child
с аналитически заданными положением, размером и радиусом. CSS сам нормализует
перекрытие углов child. Остальные шесть случаев сравниваются с нативной тенью.
Допуск не менялся: ноль различий больше 5 единиц RGB внутри плоских 3×3 участков
эталона. Проверка также требует `getComputedStyle(subject).boxShadow === 'none'`,
чтобы нативная отрисовка не могла скрыть дефект production shadow.

Основания: [CSS Shadow Shape](https://www.w3.org/TR/css-backgrounds-3/#shadow-shape),
[Corner Overlap](https://www.w3.org/TR/css-backgrounds-3/#corner-overlap).
Эти два правила и CSS/SVG-примеры проверены отдельным агентом без изменения production-кода.
