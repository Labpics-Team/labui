# LabUI для Windows

`LabButton` — нативный `Microsoft.UI.Xaml.Controls.Button` с внешним видом LabUI.
Этот срез содержит accent/fill в размерах Small, Medium и Large: подпись Geist,
описание, две позиции иконок, hover, pressed, focus и disabled.

## Подключение

Добавьте project reference на `LabUI.WinUI.csproj` и передайте MSBuild свойство
`LabMotionProject` с путём к `native/windows/LabMotion.WinUI.csproj` совместимого
LabMotion checkout. Проект пока не распространяется как готовый NuGet SDK.
Нужны .NET 10, Windows SDK 10.0.26100 и Windows App SDK 2.6.4.

```xml
<lab:LabButton xmlns:lab="using:LabUI.WinUI"
              Content="Продолжить" Size="Medium" Click="Continue" />
```

`Content` принимает строку. `Description` добавляет короткое описание в ту же
строку; `LeadingIcon` и `TrailingIcon` принимают стандартный `IconSource`.
`Command`, `CommandParameter`, `Click`, клавиатура и automation остаются API
базового Button. При необходимости задайте `AutomationProperties.Name`.

## Цвет и движение

`generated/ThemeResources.g.xaml` формируется из готовых paints LabColors.
Компонент использует семантические brushes, включая их alpha, и не решает цвета.
Размеры и параметры эффектов в `Geometry.g.cs` формируются из владельцев LabUI.
Генератор: `node native/windows/generate-theme.mjs`; проверка дрейфа: та же
команда с `--check`. Генерация требует совместимый Program API LabColors из
`packages/colors`, а не опубликованный старый API движка.

`RequestedTheme` переключает светлый и тёмный режимы, в том числе при нажатии.
Обычный режим сохраняет эталон. Windows HighContrast пока не квалифицирован;
он не назначается автоматически режимом LabUI повышенного контраста. Полноценный
контрастный provider и пересчёт нового бренда/фона на устройстве остаются условиями
выпуска нативного SDK.

Win2D рисует три поверхности при изменении paints, размера или DPI. В кадрах
перехода LabMotion меняет их непрозрачность через Composition. Отмена анимаций
в настройках Windows переводит состояние сразу к цели. Подписки, motion channels,
bindings и графические ресурсы освобождаются при unload и смене шаблона.
`MotionFailed` сообщает отказ исполнителя; без обработчика исключение попадает
в обработчик необработанных ошибок приложения.

## Пример и проверка

`examples/windows/Buttons.csproj` содержит приложение со сменой темы, размерами,
описанием, иконками, включением и отключением кнопки.

```powershell
dotnet build examples/windows/Buttons.csproj -p:Platform=x64 `
  -p:LabMotionProject=C:\src\labmotion\native\windows\LabMotion.WinUI.csproj
```

Сборка не подтверждает визуальное соответствие или поведение ввода. Перед выпуском
нужно сравнить native render с принятым эталоном в обеих темах и DPI, проверить
pointer exit/re-entry, capture loss, Space/Enter, Command/automation, прерывание
движения, disable/unload, повторное подключение, смену шаблона и тему во время
pressed. Включение reduced motion должно завершать уже идущее движение.

Geist включён под OFL; версия, внутреннее имя и хеши находятся в
`Assets/Fonts/PROVENANCE.md`. Win2D 1.4.0 используется под MIT.

## Sheet

`LabSheet` занимает выделенный ему конечный viewport и размещает `Content` в
нижней поверхности. По умолчанию используется `Half`: при 375×812 DIP верх Body
находится на 390 DIP, высота — 422 DIP. Верхние углы — 32 DIP;
содержимое начинается после drag area и
отступа, на 48 DIP от верха Body. Header и Controls по умолчанию отсутствуют.

```xml
<lab:LabSheetHost xmlns:lab="using:LabUI.WinUI">
  <lab:LabSheetHost.Content>
    <TextBlock Text="Содержимое страницы за панелью" />
  </lab:LabSheetHost.Content>
  <lab:LabSheetHost.Sheet>
    <lab:LabSheet State="Flex" Material="Blur" GeometryScale="1">
      <TextBlock Text="Содержимое панели" />
    </lab:LabSheet>
  </lab:LabSheetHost.Sheet>
</lab:LabSheetHost>
```

`State` принимает `Full`, `TwoThirds`, `Half`, `OneThird`, `Flex`. В эталоне
от 2026-11-04 высоты Body для Full, TwoThirds и OneThird фиксированы:
776, 540 и 270 DIP при масштабе 1. Half делит высоту с Ghost поровну с
перекрытием 32 DIP. Flex измеряет содержимое при ширине окна минус боковые
отступы; пустая поверхность имеет высоту 40 DIP. При наличии Content добавляются
его высота и отступ 24 DIP. Длинное содержимое доступно через штатный ScrollViewer.
Его ScrollContentPresenter передаёт содержимому конечный размер: ListView и другие
контролы сохраняют собственную область прокрутки без обязательного `Height`.
Обычная панель может иметь большую фактическую высоту; её прокрутку учитывает WinUI.
Каждая поверхность ограничена высотой viewport и остаётся у его нижнего края.
Верх Full на 36 DIP относится к окну высотой 812 DIP; это не постоянный верхний отступ.

`GeometryScale` умножает токены размеров, включая фиксированные высоты,
перекрытие, отступы и индикатор. Он не меняет размер viewport и не умножает
уже измеренную высоту Content. Системные DPI и масштаб текста применяются отдельно.
Flex измеряет содержимое при конечной доступной высоте. Используются
[Measure WinUI](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.uielement.measure) и
[SizesContentToTemplatedParent](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.scrollcontentpresenter.sizescontenttotemplatedparent).

Состояния меняются статически. Перетаскивание и движение должен исполнять LabMotion.
Контрол не устанавливает modal focus, закрытие по Escape или блокировку фона:
эти свойства ещё требуют полноценного сценария Sheet.

`LabSheetHost.Content` содержит живую сцену, а `LabSheetHost.Sheet` — панель.
Host размещает их в соседних поддеревьях одного viewport. Ghost и Body читают
одну CompositionVisualSurface сцены: захват не содержит панель, её содержимое
и уже нарисованные эффекты. Потребитель не передаёт приватный Composition Visual.
При замене шаблона, сцены или панели прежний capture отсоединяется от источника.
До загрузки и измерения сцены Blur остаётся неготовым и восстанавливается по
событиям сцены; он не превращается в Solid. Отдельный Solid не требует host.
Сцена и панель используют один XamlRoot; поддержаны осевые viewport без отражения.

`Material` принимает `Blur` и `Solid`. Blur использует графы нативных эффектов
с общим источником и итоговым LayerVisual. В Light применяется
ColorDodge, в Dark — Overlay. Все краски, включая noise, приходят из LabColors;
размеры — из токенов LabUI, тени — из существующей ступени Shadow XL.
При выключенной Transparency или недостаточных возможностях Composition выбирается
непрозрачный Solid с существующей базой Elevated/Grouped Secondary.
`EffectiveMaterial`, `MaterialReason` и событие `EffectiveMaterialChanged` показывают
этот исход. До успешного построения графики фактические значения равны `null`.
Solid не создаёт Composition effect graph. Glass и High Contrast не квалифицированы.

Соответствие материала эталону ещё требует сравнения native PNG. Начальная
гипотеза переводит Figma blur radius в Win2D sigma как `radius / 2`; восемь
Gaussian-ветвей аппроксимируют Ghost с пространственными весами. Шум пока имеет
один sample на физический пиксель. Эти решения не подтверждают точность Figma
noise size 0.2, непрерывного progressive blur или бюджет GPU. Внешние WebView2,
MediaPlayerElement и SwapChainPanel не входят в поддержанный источник backdrop.

Ghost рисуется семью неперекрывающимися интервалами между исходными уровнями.
Внутри каждого интервала Add складывает две соседние Gaussian-ветви. Одна
общая ramp-маска задаёт веса через DestinationOut и DestinationIn, поэтому
их сумма остаётся единицей после растеризации и линейной фильтрации,
включая прозрачную сцену. Идеальный профиль сохраняет исходные восемь уровней;
точность его растровой аппроксимации проверяется отдельно.
Кисти используют координаты всего viewport, а hard clips разделяют интервалы.
Промежуточного захвата нарисованных эффектов нет: каждый читает ту же исходную
сцену. Полосы повторяют внутренние blur-уровни в соседних графах; отсутствие
швов при fractional DPI и стоимость GPU требуют проверки реальным рендером.

Источник — корень сцены, поскольку [CompositionVisualSurface.SourceVisual](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.composition.compositionvisualsurface.sourcevisual)
задаёт захватываемое поддерево. Кисть BackdropBrush читает окружение за SpriteVisual;
захват отдельного визуала с такой кистью не переносит его окружение в surface.
Парный native PNG проверяет, что изменение сцены действительно распространяется
на соседние пиксели Ghost и Body; успешного создания effect factory недостаточно.

После сборки пример запускается как `Buttons.exe --sheet`; `--dark`, `--solid`
и `--content` выбирают тему, материал и пример содержимого.
`--sheet-state=full|two-thirds|half|one-third|flex` и `--sheet-scale=1.5` выбирают
состояние и геометрический масштаб. Для исходной пробы
нужны клиентская область 375×812 и DPI 100%. Фон находится в
`examples/windows/Assets/SheetBackdrop.png`: это исходная текстура, а не снимок
готового Sheet. Обычный запуск без `--sheet` сохраняет пример Buttons.

`LABUI_SHEET_OBSERVATION` задаёт путь одноразового JSON примера с PID/HWND,
фактической геометрией, темой, загрузкой изображения и состоянием renderer.
`rendererReady` подтверждает построение графики; визуальное соответствие
проверяется отдельно по захваченным пикселям.

`--sheet-content=list|long|short` включает пассивную пробу содержимого: ListView
из 1000 элементов без `Height`, панель высотой 3000 DIP или панель высотой 100 DIP.
Поле JSON `contentWitness` содержит входные размеры последнего измерения, признак
неконечного размера, фактическую высоту, размеры прокрутки и число созданных
контейнеров списка. При 375×812 и DPI 100% Half должен измерить список при высоте
358 DIP; длинная панель должна иметь scroll extent больше viewport; короткий
Flex должен иметь высоту поверхности 164 DIP. Эти условия требуют запуска WinUI
на Windows; локальная сборка проверяет только готовность пробы к исполнению.

Проверка геометрии без UI:
`dotnet run --project native/windows/test/sheet-geometry.test.csproj`.
