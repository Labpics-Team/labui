# Native Input и Textarea: целая подпись и авторская геометрия

Проверено 18 ноября 2026 в `ImageComposeScene`: настоящий Compose/Skia и
поставляемый Geist, без окон, NVDA или звука. Ширина сцены — 320 dp.

Исходные размеры взяты из неизменённой [Lab UI Figma](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1)
и общего [components.json](../../../../packages/tokens/src/components.json).
Input имеет рамку 36/48/56 dp и подпись 12/12. Отдельный Textarea имеет
минимальную рамку 112 dp, radius 12, подпись 14/12, helper 12/12 и отступы
16/24/20/16 dp (верх/низ/начало/конец). Три строки — начальная вместимость;
дополнительный текст и системный размер шрифта увеличивают поле.
Профиль генерируется существующим `generate-components.mjs`.

Первичная регрессия: `maxLines = 1`/ellipsis теряли конец «Почта для
уведомлений» при 200%. До изменения независимый `BasicText` совпал с Input
во всех размерах при 100/125%, а при Small/200% сравнение обнаружило
потерянный пиксель буквы `(186, 48)`. Снимок [до исправления](small-200-before.png)
сохранён. Теперь полный текст измеряется по той же доступной ширине,
дополнительные baseline увеличивают верхний отступ ввода и высоту поля,
а разрыв рамки соответствует первой строке и направлению текста.
Это следует из контрактов Compose для [maxLines и overflow](https://developer.android.com/develop/ui/compose/text/configure-layout).

`InputRenderTest` проверяет по 90 сцен для Input и Textarea: S/M/L,
100/125/200%, LTR/RTL, короткую подпись, исходную длинную подпись,
несколько длинных слов, слово без пробелов и явный перевод строки.
Каждый пиксель подписи сравнивается с независимым текстовым рендером;
пиксели ввода должны сместиться ровно на добавочную высоту подписи.
Дополнительно проверяются доступное имя, прежний редактор, фокус,
выделение и последующий ввод. Третий тест проверяет helper 12/12,
disabled/danger colors и фокус в обеих темах.

Авторская геометрия Input при 100% осталась побайтно прежней:

| Размер | Рамка + вынос подписи | SHA-256 PNG до и после |
| --- | --- | --- |
| [Small](small-100-ltr-short.png) | 36 + 8 dp | `17cef6ab3caa840fc57adf8c80029baa74d6e476e3f8497474c9856b4cec2246` |
| [Medium](medium-100-ltr-short.png) | 48 + 8 dp | `beb1e02b708a2113d3b9c25d2fb988f353288efb85cb8bde4d6b0c7130dcf58a` |
| [Large](large-100-ltr-short.png) | 56 + 8 dp | `ec63c85b39fa8090ec7802f575cbf66f7c2811a7e97bbc95210343830f8460d2` |

Характерные рендеры: [Input Small 200%](small-200-ltr-long.png),
[Input Medium 200%](medium-200-ltr-long.png), [RTL](medium-200-rtl-long.png),
[Textarea 200%](textarea-medium-200.png), состояния Textarea
[light](textarea-states-light-100.png) и [dark](textarea-states-dark-100.png).

`SettingsLayoutTest` дополнительно прошёл настоящий сценарий редактирования
и сохранения при 320 × 320 dp и 200%; [подпись почты целиком](edit-320-320-200-email.png)
видна после прокрутки к полю. Прокрутка к Save и запись черновика также
проверены. Рендер не заменяет системную проверку IME или screen reader.

```sh
native/compose/gradlew -p native/compose :desktopTest --tests pics.lab.ui.InputRenderTest
native/compose/gradlew -p native/compose/consumer desktopTest \
  --tests pics.lab.ui.sample.SettingsLayoutTest \
  -PuiSource=<checkout>/native/compose \
  -PiconsSource=<accepted-icons-checkout>/native/compose -PiconsVersion=0.3.0
node native/compose/scripts/generate-components.mjs --check
```

Colors использует публичную поставку. Icons в этом прогоне использует
тот же принятый development source, что и native CI; Maven-релиз Icons
этот прогон не утверждает.
