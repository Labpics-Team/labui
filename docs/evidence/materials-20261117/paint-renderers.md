# Авторские paints в трёх compositor

Профиль Figma не менялся. Формула — Normal → Color Dodge (Light) или Overlay
(Dark), в encoded sRGB; у Acrylic перед ними Screen-зерно. Решение основано
на [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/) и
дисплейных снимках настоящего compositor, а не только `CSS.supports`.
`render-material-paints.mjs` исполняет собранный production-пакет: все пять
уровней в двух темах, шесть цветных фонов, отдельный цветной рецепт и усиленное
зерно. Проверяется поверхность с transform, сохранение ресурсов при 30 кадрах
translation/scale и полное удаление при dispose.

| Renderer | Paints | Зерно |
| --- | --- | --- |
| Chromium | общий SVG transfer на backdrop | PNG → Screen перед paints |
| Firefox | общий SVG transfer на отдельном capture | bounded uniform midpoint штатного PNG |
| Safari | нативные Normal/Color Dodge/Overlay | PNG → нативный Screen перед paints |

В Firefox таблица из **257** значений в обычном SVG-фильтре по захваченному
backdrop повреждала каналы. 256 значений дали ≤0.481 RGB на цветном рецепте;
те же 256 значений используются и в Chromium, и в SSR compiler.
Проверка точности интерполяции всех десяти author recipes сохраняет предел
0.15 RGB между узлами. Это не утверждение о любых пользовательских рецептах.

`feBlend` Screen и равносильный `feComposite` arithmetic (`k1=-1,k2=1,k3=1`)
видят собственный SourceGraphic элемента вместо захваченного фона в Gecko.
С усиленным зерном оба дают ошибку 175 RGB. Нативная смесь без изоляции работает,
но один `translateZ(0)` снова даёт 105 RGB. Поэтому геометрия компонента не
определяет выбор реализации. Исходные опыты:
[257/256 и структура групп](https://github.com/Labpics-Team/labui/actions/runs/44093116119),
[arithmetic и transform](https://github.com/Labpics-Team/labui/actions/runs/44095393690).

Firefox использует середину диапазона только известного авторского PNG:
его цвет `[1,2,5]`, максимальная alpha после запекания `10/255`. Для канала
отклонение входа от середины ≤`noise[channel] × maxAlpha / 2`.
Умножение на глобальный наклон двух последовательных paints ограничивает
ошибку для любого backdrop и каждой точки зерна. Максимум всех десяти ролей —
**0.0578512397 RGB**, Light/Subtle. Для остальных ≤0.052780.
Ни seed, ни конкретная фаза текстуры, ни выбор фона в доказательстве не нужны.
Если этот bound достигает 1 или источник PNG иной, адаптер возвращает
`data-lab-material-grain="unsupported"`, а не усредняет неизвестную текстуру.

Нативный Color Dodge Safari усиливает округление промежуточной Normal-заливки
возле перелома. В контрольном насыщенном custom-рецепте raw error был 5.481 RGB;
диагностика сохраняет это число и проверяет диапазон, полученный из ±1 RGB
промежуточного Normal и ±2 RGB финального смешивания. Авторские роли проверяются
с отдельным пределом 2 RGB. Обычные snapshots Firefox/WebKit не подтверждают
backdrop: для них используются Linux Xvfb/macOS screencapture.

Финальный исходник `51cfe7d`,
[run44100730329](https://github.com/Labpics-Team/labui/actions/runs/44100730329):

| Реальный compositor | Все author paints, max RGB | Цветной custom paint, max RGB |
| --- | ---: | ---: |
| Chromium Linux/macOS | 0.999 | 0.963 |
| Firefox Linux/macOS | 0.503 | 0.496 |
| Safari/WebKit macOS | 1.280 | 5.482 |

Author-числа включают варианты без зерна и со штатным зерном, относительно
формулы без зерна. Верхняя ошибка midpoint выше доказана отдельно.
Усиленный custom grain рисуется пространственно в Chromium/Safari (≤1/≤0.471 RGB),
а Firefox явно сообщает `unsupported` и сохраняет фон без этой текстуры.
Полные строки: [Linux](material-paints-final-display-linux.json),
[macOS](material-paints-final-display-darwin.json).

30 кадров translation/scale шести поверхностей: ноль мутаций фильтров/capture,
все узлы сохранены, финальный dispose удаляет их полностью. p95 интервала rAF:
Chromium Linux 17.3–17.4ms, Firefox Linux/macOS 18–19ms, Safari 18ms;
Chromium macOS 17.6–28.9ms. Это маленькая compositor-сцена на hosted CI,
не измерение стоимости JS и не обещание fps для полного Sheet.
Проверки общего исходника: CI build/typecheck/unit и Playwright smoke зелёные;
локально 180 Colors и 166 Materials.

Эта проверка закрывает перенос paints и ограничение зерна. Она не закрывает
оставшиеся различия геометрии, светового края и дисперсии Glass. Для следующего
сравнения отдельно экспортированы неизменённые `figma-dock-holdout.json/png`,
Floating Dock `7671:9049`; эта сцена не участвовала в подборе линзы по кругам.
