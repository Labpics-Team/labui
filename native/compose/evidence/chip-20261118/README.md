# Chip: Compose и авторский источник

Проверено 18 ноября 2026. Геометрия, роли, baseline, skeleton и контур крестика
берутся из `packages/tokens/src/components.json#chip`; `LabComponents.kt` сгенерирован
из этого профиля. Авторский источник: [Chip в Lab UI v2.1](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6220-4785).
Figma не открывалась и не изменялась. Использованы сохранённые полные деревья
56 вариантов и 12 оригинальных SVG из read-only чтения.

`comparison.png` сопоставляет 12 оригинальных SVG и CPU-рендер Compose в 1×.
Оригиналы локально растеризованы Chromium при DPR 3, затем приведены к размеру
использования; это **не PNG-экспорт Figma**. Native-снимки вырезаны из реального
атласа по измеренным границам. Сравнение просмотрено визуально; попиксельная
идентичность разных растеризаторов не заявляется. Native показывает настоящий
Geist, исходные SVG содержат контуры текста.

У всех 56 сочетаний при обычном масштабе измерены авторские размеры: Small 28 dp,
Medium 40 dp, ширина «Chip label» 83/99 и 101/133 dp без/с выбором. Small Rounded
имеет радиус 9999, Medium Rounded — 12; Sharp — 4. Source baseline 11/18 внутри
строки 12/24 устраняет платформенные верхние/нижние поля шрифта. `BasicText`
измеряется один раз; высота многострочной подписи учитывает расстояние между
первым и последним baseline. Текст и его доступная семантика остаются настоящими.

Контур крестика компилируется из того же профиля в числовые команды Compose во
время генерации. Два общих `Path` создаются лениво по одному разу и затем только
читаются; каждый Chip масштабирует и сдвигает canvas через `withTransform`.
При mount нет разбора SVG, копии Path и отдельной Matrix. Генератор отвергает
неподдерживаемые команды, незамкнутый контур и неверные числовые операнды.
После этой замены четыре проверки прошли повторно, а все шесть native PNG
побайтно совпали с рендером до замены. Контур Chip отличается от standalone
Icons close, поэтому не подменяется его геометрией. Основание работы с canvas:
[Compose: multiple transformations](https://developer.android.com/develop/ui/compose/graphics/draw/overview#multiple-transformations).

Loading сохраняет текст с opacity 0, ту же ширину и размер крестика. В source
loading подписан «Chip 1», а selected Medium использует скрытый крестик 16 вместо
24 dp. Runtime сохраняет действующий текст и 24 dp, чтобы pending не сужал chip.
Rounded Small skeleton имеет радиус 9999; остальные skeleton — 4. Source loading
и runtime loading поэтому намеренно имеют разную ширину на `comparison.png`.

`ChipRenderTest` прошёл четыре проверки:

- 56 вариантов × Light/Dark × 100/200%: геометрия, текст, значение, Geist Medium,
  конечные границы. Hover, press и focus подаются через native interaction source.
- Реальные Space и Enter, controlled отказ, тот же узел/фокус/имя/ширина во время
  pending, подавление повторного действия, отсутствие idle-анимации и disabled pointer.
- По одной именованной кнопке для action и remove. Remove требует явное имя
  действия и отправляет одно событие; приложение выполняет удаление и перевод фокуса.
- Длинный текст при 200%, LTR и RTL: все строки измеряются без обрезания, leading
  следует своему 16 dp размеру, pending сохраняет весь прямоугольник.

Семантика выбрана LabUI, а не извлечена из Figma: `Filter` — кнопка с toggleable
состоянием и `onSelectedChange`, `Action` — `onAction`, `Remove` — `onRemove` и
`accessibilityLabel`. Везде один native target. `active` — независимый авторский
акцент, pointer press временно показывает отдельную нейтральную поверхность и glow.
Skeleton статичен; ни обычное, ни уменьшенное движение не создают постоянный цикл.
Основание семантики: [WAI-ARIA Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
и [Compose semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics).

`ChipFilterExample` — отдельная потребительская композиция с реальным списком
материалов. `ChipConsumerTest` проверил выбор клавиатурой, изменение списка,
сброс и границы при 320 dp/200%. `chip-consumer-320-200.png` показывает этот путь;
весь пример прокручивается при нехватке высоты. Существующий экран настроек не
менялся. Проверка использовала составную сборку нового LabUI и Icons 0.4.0
из commit `bd9937ca65e684589a1ee488f2b3f452849044d0`; она подтверждает API потребителя,
но не является проверкой опубликованных Maven-байтов.

Команды из корня LabUI (JDK 21):

```powershell
./native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.ChipRenderTest --console=plain
$env:ORG_GRADLE_PROJECT_uiSource = (Resolve-Path native/compose).Path
$env:ORG_GRADLE_PROJECT_iconsSource = 'D:/AgentWork/lab-icons-optics-motion-20261117/native/compose'
$env:ORG_GRADLE_PROJECT_iconsVersion = '0.4.0'
./native/compose/gradlew.bat -p native/compose/consumer desktopTest --tests pics.lab.ui.sample.ChipConsumerTest --console=plain
python native/compose/evidence/chip-20261118/compare-source.py D:/AgentWork/.scratch/chip-source-20261118
```

PNG и измерения воспроизводятся в `native/compose/build/chip-render/`; consumer —
в `native/compose/consumer/build/chip-consumer/`. Все сцены — `ImageComposeScene`
на CPU, без окон и озвучки. Android/iOS-устройства и системные screen readers
этими проверками не покрыты.
