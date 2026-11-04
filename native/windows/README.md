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

## Sheet Half

`LabSheet` занимает выделенный ему конечный viewport и размещает `Content` в
нижней поверхности. При 375×812 DIP верх Body находится на 390 DIP, высота —
422 DIP. Верхние углы — 32 DIP; содержимое начинается после drag area и
отступа, на 48 DIP от верха Body. Header и Controls по умолчанию отсутствуют.

```xml
<lab:LabSheet xmlns:lab="using:LabUI.WinUI" Material="Blur">
  <TextBlock Text="Содержимое панели" />
</lab:LabSheet>
```

Это статический срез для проверки материала. Перетаскивание, Flex и остальные
положения пока не реализованы. Движение следующего среза должен исполнять LabMotion.
Контрол не устанавливает modal focus, закрытие по Escape или блокировку фона:
эти свойства ещё требуют полноценного сценария Sheet.

`Material` принимает `Blur` и `Solid`. Blur строит единый Composition effect graph:
ветви Ghost и Body читают один исходный in-app backdrop. В Light применяется
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

После сборки пример запускается как `Buttons.exe --sheet`; `--dark`, `--solid`
и `--content` выбирают тему, материал и пример содержимого. Для исходной пробы
нужны клиентская область 375×812 и DPI 100%. Фон находится в
`examples/windows/Assets/SheetBackdrop.png`: это исходная текстура, а не снимок
готового Sheet. Обычный запуск без `--sheet` сохраняет пример Buttons.

`LABUI_SHEET_OBSERVATION` задаёт путь одноразового JSON примера с PID/HWND,
фактической геометрией, темой, загрузкой изображения и состоянием renderer.
`rendererReady` подтверждает построение графики; визуальное соответствие
проверяется отдельно по захваченным пикселям.

Проверка геометрии без UI:
`dotnet run --project native/windows/test/sheet-geometry.test.csproj`.
