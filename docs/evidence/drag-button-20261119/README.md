# Drag Button: source and installed consumers

Проверено 19 ноября 2026. Сравнение использует Figma version `2423213750570316842`,
пять состояний component set `7530:7995` и Light/Dark frames `7530:6820` / `7530:6822`.
`figma-source.json` — сохранённое REST-поддерево набора; PNG экспортированы из той же версии.

- [Пять авторских состояний: Figma / Chromium / WebKit / Compose](comparison-authored-light.png).
- [Обе темы при авторской ширине 416](comparison-themes.png).
- [Helper: фрагмент шрифта 6× без интерполяции](comparison-helper-crop.png).
- [Web, 200%, ширина 320](chromium-dark-200-320-idle.png).
- [Длинный web-результат, 200%](chromium-dark-200-320-long-success.png).
- [Длинный Compose-результат, 200%](native/native-dark-200-320-long-success.png).
- [Приложение с установленным Maven-пакетом, 200%](native/consumer-dark-200.png).

Геометрия, тексты, маска и glow проверяются `scripts/verify-drag-button-source.mjs`.
Button растёт с 48 до 1136 px, сохраняя высоту 48 и радиус 16; внешний контейнер
1144×56, padding 4, radius 20. Mask состоит из пяти независимо размытых элементов.
Обе фазы движения сохраняют authored glow; Danger сохраняет checkmark.

`comparison.json` содержит численное сравнение всех пикселей после помещения
прозрачного Figma-экспорта на белый фон. Средняя абсолютная разница RGB — 0.63–1.56
из 255. В трёх контрольных точках маски web и Compose совпадают; от Figma отличаются
на 1–2 уровня RGB. Контуры текста и Icons растеризуются разными движками.
Это сравнение с общими опубликованными Icons, без локальных копий их контуров.
Скрипт сравнения отклоняет разницу выше 4 RGB, достаточную для обнаруженного дефекта
pressed-gradient (до исправления 10.46 RGB в Chromium).

Шрифт проверен после `document.fonts.ready` и явного `fonts.load('500 16px Geist')`.
В Chromium и WebKit загружен Geist, computed weight 500; ширина «Swipe it» —
60.39032 и 60.39034 px. Метаданные находятся в `packed.json`. Более лёгкий край
WebKit сохраняется при том же шрифте и весе; авторский вес не изменён ради сглаживания.

Нативная маска растеризуется штатным Gaussian blur в `drawWithCache` при изменении
размера или density. Кадр движения читает готовый ALPHA_8 bitmap, содержащий только
видимые пиксели дорожки: 64 064 байт для 1144×56 при 1×, 256 256 байт при 2×.
Исходные прямоугольники остаются привязаны к правому краю и центру по вертикали;
временные расширенные области нужны только при вычислении blur.
При 180 CPU/offscreen кадрах без PNG медиана снизилась с 14.678 до 1.577 мс при 1×
и с 56.928 до 3.408 мс при 2×. P95 — 2.206 / 4.439 мс; JVM allocation — около
23 КиБ/кадр. Это локальное измерение Windows/Skia SOFTWARE, не обещание для любого устройства.
Данные: [до](native/frame-cost-before.tsv), [после](native/frame-cost-after.tsv).

| Проверка | Результат |
| --- | --- |
| Source verifier | Пять состояний, Button metrics, текст, mask gap/anchor, glow size/offset/blur/opacity |
| Core | 93 теста, включая SSR без JS и завершённый результат до hydration |
| Adapter codegen/catalog | 32 теста; generated catalog соответствует зафиксированным Kotlin-источникам |
| Packed npm | React + Vue/Solid/Svelte/Astro bindings; ESM/CJS, NodeNext declarations, SSR/hydration |
| Chromium + WebKit | Pointer, click, Enter/Space, partial/Escape/pointercancel/resize cancellation, RTL, disabled, reset, один commit |
| Motion | Новый жест прерывает возврат; старая анимация не меняет его ширину; после возврата нет зафиксированной px-ширины |
| Web render | Light/Dark × 100/125/200% root font × 320/416/1144 px; длинный результат переносится |
| Compose | 6 CPU/offscreen tests: gestures, resize/RTL/reset, keyboard/focus, состояния/масштабы, отсутствие helper overflow, frame cost |
| Installed Maven consumer | Light/Dark × 100/125/200% fontScale; две явные попытки, без двойного перевода |
| Build | Tokens, core, React, generated adapters и docs; core/React/docs typecheck; Biome changed source |

Compose использует масштаб текста платформы: dp-геометрия кнопки не увеличивается
вместе с fontScale. Web-матрица увеличивает root rem, включая геометрию. Поэтому
сравнение пикселей с Figma выполняется при 100%, а крупный текст проверяется отдельно.

Проверки используют `@labpics/icons:0.4.0` из локального release tarball и
`pics.lab:icons-compose:0.4.0` из проверенного CI Maven-артефакта Icons PR139.
Публичный npm registry в момент проверки ещё возвращал 0.2.0. `packed.json`
честно сохраняет `publicIcons: false`; это не свидетельство публичной установки 0.4.0.
SHA256 Icons tarball: `94935519919b402ee3685d20deefa561f3c92a72500c288a9ba2bf7c209b45f3`.
UI Maven проверен как `0.1.0-drag6-20261119`; production manifests сохраняют релизные
координаты, не локальные пути. После публикации Icons тот же packed test работает без override.

```sh
node scripts/verify-drag-button-source.mjs docs/evidence/drag-button-20261119/figma-source.json
node apps/docs/tests/drag-button-packed.mjs
python docs/evidence/drag-button-20261119/build-comparison.py
```

До публикации Icons перед packed test требуется `LAB_ICONS_TARBALL` с проверенным
архивом. Native test запускается с `JAVA_TOOL_OPTIONS=-Djava.awt.headless=true`,
`SKIKO_RENDER_API=SOFTWARE` и Maven repositories; `includeBuild` для UI не используется.
Проверяются `pics.lab.ui.DragButtonRenderTest` и
`pics.lab.ui.sample.DragButtonConsumerTest` в отдельных Gradle-проектах.
Локальная Android-компиляция требует отсутствующего на машине SDK; Android actual
остаётся проверке интеграционного CI. Desktop actual общий с iOS Skiko, но iOS runtime
на этой Windows-машине не выполнялся.

Источники решений:
[Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html),
[Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events),
[Compose 1.12.2 source](https://repo1.maven.org/maven2/org/jetbrains/compose/ui/ui-graphics-desktop/1.12.2/ui-graphics-desktop-1.12.2-sources.jar),
[Android RenderEffect](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/libs/hwui/jni/RenderEffect.cpp).
Последние два источника подтверждают преобразование blur radius → Skia sigma
`0.57735 * radius + 0.5`; обратное преобразование находится в общей внутренней функции.
[Skiko RenderNode](https://github.com/JetBrains/skiko/blob/v0.150.2/skiko/src/commonMain/cpp/common/node/RenderNode.cpp)
кэширует команды рисования, что не устраняет повторный blur в saveLayer; поэтому
маска сохраняется как растровый результат.
