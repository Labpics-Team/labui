# Прозрачность декоративного материала

Figma и рецепты цветов не менялись. Alert передаёт прозрачность декоративного
слоя в общий renderer: Chrome применяет её к своему capture-host, Gecko — к
отдельному SVG capture, WebKit — к отдельному native capture.

WebKit не смешивает вложенные native paints с backdrop родителя. Это отдельно
подтверждено даже при opacity=1: [run 44732892568](https://github.com/Labpics-Team/labui/actions/runs/44732892568).
При этом обычные CSS filters после blur работают, а SVG URL там игнорируется:
[исторический run 44083835241](https://github.com/Labpics-Team/labui/actions/runs/44083835241).

Нейтральный аффинный перенос `m*x+b` точно выражается как
`contrast(m/(m+2*b)) brightness(m+2*b)`. Промежуточный contrast не клиппирует
каналы. Классификация использует концы и все точки перелома исходной формулы,
а не название темы, уровня или подбор коэффициентов. Нелинейные и цветные
рецепты сохраняют native blending. Все четыре авторских рецепта Base/Muted
относятся к аффинным; новый путь не обещает group alpha для произвольного
цветного или нелинейного пользовательского override.

Spatial Screen-зерно остаётся отдельным слоем после переноса. Для аффинного
пути ошибка изменения порядка ограничена максимальным premultiplied каналом
зерна: `5 * (10/255) < 0.197 RGB`, для любого фона, blur и alpha. Пользовательская
неизвестная текстура не получает этот допуск. Runtime сообщает
`spatial-bounded` и фактическую границу; цикл генерации текстуры не добавлен.

[Диагностический run 44739094282](https://github.com/Labpics-Team/labui/actions/runs/44739094282)
на реальном macOS WebKit дал response задних слоёв 7–21 RGB, negative control 0,
ошибку alpha 0.04–0.36 RGB. Это опыт, не квалификация итогового production commit.
При измерении alpha соседи остаются неизменными: они входят в захватываемый фон.
Одновременное изменение прозрачности соседних слоёв не является линейным опытом.

Локально после изменения: Materials 183/183, TypeScript и Biome PASS.
Реальная квалификация собранного пакета и независимое ревью ещё выполняются.

Основание: [CSS Filter Effects 2, compositing](https://drafts.csswg.org/filter-effects-2/#backdrop-filter-operation)
и [Compositing and Blending](https://www.w3.org/TR/compositing-1/).
