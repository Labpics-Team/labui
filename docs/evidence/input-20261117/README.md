# Input: авторская геометрия и настоящая форма

Источник — сохранённая неизменённая Figma Lab UI, узлы Small 6034:3459,
Medium 6050:1672, Large 6050:1712; [точные части](figma-source.json).
Размеры 36/48/56, радиусы 16/12/12, caption 12/12 с выносом 8 px.
Слоты имеют ширину 32 px и glyph 16 px. Все значения переводятся в rem
из components.json, общего с Compose; независимой таблицы web нет.

Один inputCss задаёт Lit/React. Fieldset/legend оставляет прозрачный разрыв
под настоящей label, поэтому поле не нуждается в совпадающей заливке.
Длинная label сокращается визуально и сохраняет полное доступное имя.
Нативный input сохраняет IME/выделение. Lit использует ElementInternals для
FormData, validation, reset, form state restore и disabled fieldset;
React передаёт имя и ограничения своему HTML input. Custom error действует
на валидность обоих исполнений.

Headless Chrome/WebKit: 39 проверок Input PASS, одна ожидаемая WebKit/CDP
проверка пропущена. Проверены размеры, подпись, слоты, темизация, значения,
ARIA, constraint validation, FormData/reset/restore, focus и forced colors.
114 тестов Tokens PASS. На production проходят 57 проверок Input, Sheet
и первого сценария; одна WebKit/CDP проверка пропущена. Независимое ревью
приняло Input после описанных ниже исправлений. Снимки Lit/React в двух
темах создаёт input-render.mjs.

Опора исполнения notch: [MUI NotchedOutline](https://github.com/mui/material-ui/blob/master/packages/mui-material/src/OutlinedInput/NotchedOutline.js).
Рисунок и размеры принадлежат Lab UI, а не MUI. Никакие окна и озвучивание
на рабочем столе пользователя не запускались.

Независимое ревью исходного среза963ea96 нашло нарушения default submitter,
minlength после пользовательского ввода, синхронности reset и Node-import CSS.
Исправления проверены в обоих браузерах: Enter уважает bubbling/click cancellation,
disabled submit и число полей; live(value) сохраняет нативную length-validity;
reset немедленно обновляет FormData. Ограничение16px оставлено только glyph,
а slotted-действие сохраняет собственный размер. ESM/CJS import и React SSR
проходят две отдельные проверки, включённые в pnpm test. Lit SSR без
ElementInternals также проверен прямым исполнением.

Повторное независимое ревью на production подтвердило все исправления
0cc0454 и нашло один дополнительный случай: исходный inputType="TEXT"
не учитывался при подсчёте полей, блокирующих implicit submission. Теперь
подсчёт использует нормализованный браузером HTMLInputElement.type.
Reviewer проверила TEXT, неизвестный и пустой тип с двумя полями, а также
отправку единственного поля: 8/8 сценариев в Chromium/WebKit PASS.
Дополненный Enter-тест прошёл на dev и production, typecheck и Biome PASS.
