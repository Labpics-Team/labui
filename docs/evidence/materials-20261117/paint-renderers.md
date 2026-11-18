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
backdrop: Firefox проверяется через Linux Xvfb/macOS screencapture,
WebKit — через macOS screencapture.

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

Linux WebKit **не подтверждает сохранение paints**. Его строки имеют
`measurable:false`: предел ошибки не проверяется. В этом опыте шесть разных
фонов давали одинаковые `[96,96,96]` с ошибкой до 143.0256 RGB. Это наблюдение
не различает ограничение Xvfb и ошибку `capture-blend`; зелёный workflow не
означает, что полупрозрачный paint на этой платформе корректен. JSON сохраняет
историческое измерение указанного commit, а не проверку текущей ревизии.

30 кадров translation/scale шести поверхностей: ноль мутаций фильтров/capture,
все узлы сохранены, финальный dispose удаляет их полностью. p95 интервала rAF:
Chromium Linux 17.3–17.4ms, Firefox Linux/macOS 18–19ms, Safari 18ms;
Chromium macOS 17.6–28.9ms. Это маленькая compositor-сцена на hosted CI,
не измерение стоимости JS и не обещание fps для полного Sheet.
Проверки общего исходника: CI build/typecheck/unit и Playwright smoke зелёные;
локально 180 Colors и 166 Materials.

Эта проверка подтверждает перенос paints и ограничение зерна только для
compositor в таблице выше. Она не закрывает
оставшиеся различия геометрии, светового края и дисперсии Glass. Для следующего
сравнения отдельно экспортированы неизменённые `figma-dock-holdout.json/png`,
Floating Dock `7671:9049`; эта сцена не участвовала в подборе линзы по кругам.

## Прокрутка существующей поверхности

Review выявило пропажу paints Firefox/Safari: absolute capture прокручивался
вместе с содержимым `overflow:auto`. `f41fe9f` удерживает его через sticky внутри
absolute runway. Основные компоненты располагают scrollport внутри Surface;
адаптер сохраняет работу уже существующих scroll-host без изменения их DOM
содержимого. У обычной поверхности дополнительных геометрических подписок нет.
Scroll-host наблюдает свой размер и непосредственных детей одним ResizeObserver,
содержимое — одним MutationObserver; изменения декоративных узлов игнорируются.
Прочие причины обновления — load и окончание загрузки шрифта. Прокрутка не вызывает
JS, не меняет DOM/styles и не пересобирает paints. Перед повторным измерением
размер runway обнуляется, чтобы он не удерживал прежний extent после shrink.
Trailing padding учитывается один раз, sticky покрывает полную padding box.

[Run 44110437463](https://github.com/Labpics-Team/labui/actions/runs/44110437463)
проверил собранный пакет в Chromium, Firefox и WebKit на Linux/macOS, включая
реальный compositor. В block/flex-column/flex-row/grid отдельно пройдены обе оси,
рост/уменьшение/повторный рост содержимого, border/padding и конечная позиция.
Независимый обычный элемент подтверждает совпадение scrollWidth/Height,
координат содержимого и gap. Opaque white paint остаётся `[255,255,255]`;
20 кадров прокрутки дают ноль мутаций capture, отключение — ноль подписок и узлов.
Все 384 строки измерений: [material-scroll-pixels.json](material-scroll-pixels.json).
Полупрозрачные paints по-прежнему проверяются отдельно предыдущей матрицей;
opaque проверка не подменяет их оптическую оценку.

Точность таблиц произвольной темы ограничена их дискретностью: при transparent
Normal и opaque white Color Dodge точная функция для 0.5 RGB даёт 255, а таблица
интерполирует 127.5. Контракт runtime/SSR теперь явно называет это sampled
approximation; 0.15 RGB относится только к десяти авторским recipes.

Последующее независимое ревью обнаружило отрицательные scroll origins
(RTL, reverse-flex, vertical-rl) и потерю конечного padding Firefox grid после
изменения стиля в крайней позиции. Production `7f791ef` выводит две физические
оси из writing-mode/direction и flex main/cross reversal. Runway исключён из
scroll anchoring и имеет layout containment; natural extent измеряется без него,
затем одним чтением вычитается только его реальный вклад в overflow. Это устраняет
различия учёта padding без списка browser/layout исключений. Scroll по-прежнему
не вызывает JS. Временно скрытое состояние не выходит за синхронное измерение.

[Run 44118210819](https://github.com/Labpics-Team/labui/actions/runs/44118210819)
прошёл на Linux/macOS: 12 flows × 10 stages × 3 browsers, snapshot и actual display;
отдельно все десять авторских paints измерены внутри прокрученного capture на
шести цветных фонах. Предел ошибки проверен только для строк `measurable:true`;
Linux WebKit остаётся неподтверждённым. В логе 1440 scroll и 408 paint rows; отдельно сохранены
[720 scroll и 204 paint строки реального display](material-scroll-origins.json).
Общий CI `44118210711` также прошёл.
Независимая проверка повторила 48 Firefox/WebKit сценариев; дополнительно
Chromium/Firefox/WebKit за 20 idle и 20 scroll кадров дали ноль runtime rAF
и getComputedStyle. Переключение overflow visible→hidden и dispose при pending
content refresh оставили ноль наблюдателей, captures/defs и снятый mode.
