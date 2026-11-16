# Цветовой профиль LabUI

`@labui/colors` задаёт палитру и отношения ролей Lab UI v2.1.
Вычисление выполняет опубликованный `@labpics/colors@1.0.3`:
`ProgramWireBuilderV2` → `compileProgramWire` → `updateObserved` →
`outputRgb` / `outputOpacity`. Старый `LabColors.resolveTheme` не используется.
API подтверждён установленным npm-пакетом, а не состоянием ветки main.

## Источник и первый кадр

[labui.config.json](../../packages/colors/labui.config.json) — профиль:
именованные sRGB8-опоры, непрозрачность и ссылки между семантическими ролями.
`anchors.brand` задаёт цвет семейства для light, dark и increased contrast;
текст, заливки, границы и glow ссылаются на эту опору и сохраняют собственную
непрозрачность. Изменение одной опоры обновляет все связанные роли.
`roles` содержит общие определения, `themes` — различия тем.
Ссылка `@role` означает отношение, не копию вычисленного цвета.
[figma-reference.css](../../packages/colors/figma-reference.css) остаётся
неизменяемым независимым снимком авторских цветов.

[Генератор](../../packages/colors/generate-contract.mjs) выпускает
`contract.css` из настоящих outputs Program. Его импорт даёт готовые темы
до JavaScript, WASM и hydration. Обычный `data-theme="light|dark"` работает
без runtime; отсутствие атрибута на документе учитывает `prefers-color-scheme`.
Для явного increased contrast область задаёт и `data-theme`, и
`data-contrast="more"`. `normal` сохраняет авторские primary и белую надпись
на акцентной заливке; он не обещает WCAG AA для каждой авторской пары.

`more` использует отдельные авторские IC-опоры для цветного текста,
поднимает непрозрачность лейблов и связывает нейтральную лестницу с primary.
Program выбирает primary между светлой и тёмной опорами с обязательным
WCAG 2.2 SC 1.4.3 на всех переданных подложках. Это ограничение primary,
не заявление о проверке всех состояний компонента, материала или страницы.
В обычном режиме WCAG объявлен report-only и не меняет авторскую палитру.

## Обновление области

```ts
import '@labui/colors/contract.css';
import { initializeColors, createThemeScope } from '@labui/colors/runtime';

await initializeColors();
const scope = createThemeScope(element, { onError: reportThemeError });
const result = scope.update({ theme: 'dark', contrast: 'normal' });

if (!result.ok) {
  // result.error описывает отказ; result.state — последнее применённое состояние.
}
// При удалении области:
scope.dispose();
```

`initializeColors` возвращает общий promise и принимает те же параметры,
что WASM init Colors. При переносе WASM сборщиком передайте
`{ module_or_path: wasmUrl }`; Vite-потребитель проверен с обычным `init()`.

`update` принимает `theme`, `contrast` и `backgrounds?: readonly [r,g,b][]`.
Подложки — от 1 до 64 действительно известных непрозрачных sRGB8-сценариев.
До первой явной передачи подложек используется фон текущего профиля.
Переданные приложением подложки сохраняются между обновлениями, включая смену
темы и контраста, пока приложение не передаст новые.
Видео, blur и произвольный DOM не объявляются измеренными.

Первая тема наследуется по предкам, включая ShadowRoot и slot, затем по
предпочтению ОС. У каждого подключённого элемента своя Program-сессия.
Канонические wire-байты кешируются для четырёх структур профиля, а runtime
перекомпилируется при смене темы или режима: публичный API 1.0.3 обновляет
наблюдения, но не фиксированные источники графа.

Все outputs считываются до изменения DOM. Они публикуются в локальном
stylesheet с селектором конкретной области, темы и контраста; inline-стили
приложения остаются его собственными. Runtime наблюдает только `data-theme`
и `data-contrast` подключённого элемента. `setTheme` и прямое изменение этих
атрибутов пересчитываются тем же путём до следующего кадра; обновление только
подложки использует текущие атрибуты, не возвращая прежнюю тему.

Отказ сохраняет CSS и `scope.state`, восстанавливает последние принятые
атрибуты, возвращается приложению и передаётся `onError`.
Соседние области не меняются. Runtime не сканирует документ и не запускает
кадровый цикл. `dispose()` отключает observer, освобождает WASM-сессию, удаляет
свой stylesheet и восстанавливает принадлежавшие подключению атрибуты,
сохраняя последующие изменения приложения. Повторный `dispose()` допустим.

Кнопки страницы `colors.html` приходят с серверным Declarative Shadow DOM,
сгенерированным из исходной разметки страницы. Hydration hook Lit загружается
перед динамическим импортом компонента: гидрация использует исходный DOM-узел
и сохраняет оформление и геометрию первого кадра.

## Проверки и границы

[Program-тесты](../../packages/colors/test/program.test.mjs) проверяют
авторские значения обеих тем, полярность, отказ и последующее восстановление
на реальном npm WASM. [Браузерный сценарий](../../apps/docs/tests/colors.spec.ts)
проверяет первый кадр без JS, тот же DOM-узел и геометрию после hydration,
масштаб 100/200%, настоящий Button, ShadowRoot, внешнюю смену атрибутов,
неизменность соседней области и освобождение ресурсов. Регрессионные проверки
`resolveTheme` и его принудительного изменения authored colors заменены этим
контрактом; локальная копия цветовой математики удалена.

Публичные версии отличаются от source pins: Colors здесь установлен как
`1.0.3`; отдельный Icons-consumer использует Motion `0.5.0` и проверяемый
tarball Icons. Git SHA в его исходном манифесте не означает npm-версию.
Этот цветовой профиль не подтверждает готовность native SDK или каталога.

Источники: [Colors npm](https://www.npmjs.com/package/@labpics/colors/v/1.0.3),
[Program API](https://github.com/Labpics-Team/lab-colors/tree/3f45c7e522f9a609b4cac69745c860d51f27b3fb/packages/colors),
[Lit и CSS custom properties](https://lit.dev/docs/components/styles/#theming),
[Lit SSR hydration](https://lit.dev/docs/ssr/client-usage/),
[Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
