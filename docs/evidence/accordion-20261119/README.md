# Accordion — 19 ноября 2026

Источник — read-only экспорт четырёх состояний `6088:4234` из
[Lab UI 2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Figma не изменялась. Размер при 1×: 503×56 closed, 503×88 open.

`compare-*.png` располагают авторский PNG над Chromium/Lit при 2×; прозрачный
источник скомпонован на белом фоне. Отдельные Chromium/WebKit Lit/React PNG
показывают rest/hover × closed/open, обе темы и узкую область 320 px при 100/200%.
Размер, отступы, шеврон, отсутствие рамок и hover поверхности проверены.

`source-text.generated.json` сохраняет исходные строки, TextStyle, PostScriptName
и текстовые bounds. **Расхождение Typography остаётся открытым:** поставляемый
Geist 1.400 даёт body range 334.203 px при исходном box 329 px. Read-only опыт
с Geist 1.800 даёт 328 px, но меняет заголовок; `experiment-font1800.png` не является
продуктовым рендером. `font-comparison.generated.json` содержит хеши обоих файлов.
Компонент не выбирает вторую версию шрифта и не компенсирует её размеры.
Средняя RGB-разница в `visual-difference.generated.json` — диагностика, а не
объявление попиксельного совпадения. Разбор нескольких текстовых ролей относится
к общей Typography/Fonts границе.

Проверки воспроизводятся из корня:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '<browser-cache>'
$env:PW_PORT = '4334'
pnpm --filter @labpics/ui-docs exec playwright test tests/accordion.spec.ts --project chromium --project webkit --workers 2
node apps/docs/tests/accordion-render.mjs http://127.0.0.1:4334
node apps/docs/tests/accordion-packed.mjs
pnpm --filter @labpics/ui-core exec vitest run test/accordion-ssr.test.ts
node --test packages/react/test/accordion-ssr.test.mjs
```

Browser suite проверяет клавиатуру, relationships, controlled отказ, disabled,
промежуточные кадры и retarget, немедленные inert/aria-hidden, reduced motion и
точную medium геометрию: 46/46 проверок в Chromium и WebKit. Core SSR — 5/5,
React SSR ESM/CJS — 2/2. Packed consumer устанавливает tarball всех зависимостей
во временную папку; проверяет no-JS первый кадр, четыре SSR helper, Lit upgrade
без клиентской подстановки items, React hydration, прежние DOM/id и введённый до
гидратации текст публичного Textarea. Явное `collapsible=false` сохраняется после
upgrade: открытый заголовок имеет `aria-disabled=true` до и после загрузки JS,
остаётся доступен для фокуса и не закрывает панель при Enter. Эта семантика следует
[WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/).
Оба браузера прошли проверку; результат и хеши архивов — `packed.json`.
Полноценный стандартный SSR Vue/Solid/Svelte не обозначается покрытым этим helper.

Регрессия фокуса использует публичный `LabTextarea` внутри Lit и React Accordion:
закрытие всех панелей программным изменением `value` возвращает фокус из внутреннего
textarea к заголовку нужной панели. После повторного открытия черновик сохраняется.
Отказ controlled изменения, неизменный открытый `value` и закрытие соседней панели
не теряют фокус. Четыре проверки возврата фокуса падали на прежнем runtime во всех
сочетаниях Lit/React × Chromium/WebKit; после обхода composed ancestry все проходят.
Core build, Core/docs typecheck и Biome изменённых TS/TSX также прошли.

Native-проверка прерывания использует явное время кадров `ImageComposeScene`.
Она меняет цель, пока высота находится между 56 и 88, и при том же времени
проверяет сохранение видимой позы, затем промежуточное открытие и полное закрытие.
Прежние шесть кадров с реальным временем могли закончить 100 ms анимацию до
смены цели: искусственная задержка 40 ms воспроизводит падение macOS на строке
177. Управляемые кадры проходят с той же задержкой; runtime не изменялся.
Принцип проверки промежуточных состояний с управляемым временем описан в
[Compose animation testing](https://developer.android.com/develop/ui/compose/animation/testing).
