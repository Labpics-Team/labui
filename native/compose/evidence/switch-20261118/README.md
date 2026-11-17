# Switch: авторский профиль и native-проверка

Исходник прочитан 17 ноября 2026 из [Lab UI, Switch](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=4111-884),
fileKey `LuaiBd4anRi4DMZayKAnY2`, page `4083:407`. Figma оставалась read-only.
`figma-source.generated.json` содержит 108 полных узлов и 63 переменных из чтения;
`figma-source.png` — авторский экспорт. Рабочая спецификация живёт в общем
`packages/tokens/src/components.json#switch`, а Kotlin генерируется из неё.

`comparison.png` сопоставляет исходные и native-кадры в 1× без изменения масштаба:
S/M/L × neutral/accent/danger, default без иконки, hover/pressed/focus с иконкой,
disabled off/on. В кадрах видны геометрия, наружный фокус, настоящие вырезы Check/X,
теневые различия и типографика Geist 1.400. Целочисленный crop исходного экспорта
может отличаться субпиксельным началом от native; это визуальное сравнение,
не заявление о попиксельной идентичности растеризаторов.
`*.generated.json` — машинные снимки исходника и необрезанных границ рендера;
их не форматируют вручную, как и остальные generated-файлы репозитория.

18 ноября 2026 `:desktopTest` прошёл 21 тест. `SwitchRenderTest` включает:

- 108 авторских вариантов × light/dark × 100/125/200%: шесть CPU-атласов.
  Состояния hover/pressed/focus подаются после подписки на interaction source.
  За пределами кадра проверяются необрезанные position + size, а не clipped bounds.
- Один именованный `Role.Switch`, управляемое значение, сохранение того же узла
  и фокуса при переносе, реальный Space down/up, отсутствие изменения от disabled pointer.
- 320 dp при 200%: перенос длинных русских подписей целыми словами,
  реальные границы каждой строки и пиксельное направление ползунка LTR/RTL.

`switch-long-labels-*.png` показывает узкий режим. Решение о переносе использует
intrinsic minimum ширины текстов: короткие авторские подписи остаются в строке,
а длинные занимают ширину над переключателем. Узлы не пересоздаются.
Основание: [Compose intrinsic measurements](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)
и [штатная semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics).

Рендеры получены в `ImageComposeScene` на CPU без локальных окон и аудио.
Они проверяют native-реализацию, но не заменяют системные screen readers
и платформенный запуск приложения. Платформенный CI запускается после изменения;
результат и оставшаяся работа поддерживаются в PR #240 и основном README.
