# Dialog family — 20 ноября 2026

Авторская основа: [Figma Alert Dialog](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6109-3720). `figma-source.json/png` сохраняют исходные геометрию и композицию. Web source PNGs соответствуют Lit и React; `web.json` содержит измерения и матрицу обеих тем, трёх материалов и 100/125/200%.

`packed.json` содержит SHA-256 установленных архивов и проверки React, Vue, Solid, Svelte, Astro в Chromium/WebKit: SSR/hydration, ESM/CJS, декларации типов, реальные projected triggers, сохранение DOM-ввода, подтверждение и Popover. Icons 0.4.0 установлен из артефакта общей задачи; абсолютный локальный override не входит в исходники.

Воспроизведение:

```sh
node apps/docs/tests/dialog-family.mjs
node apps/docs/tests/dialog-family-packed.mjs
pnpm --filter @labpics/ui-docs exec playwright test tests/dialog.spec.ts tests/alert-dialog.spec.ts tests/popover.spec.ts --project=chromium --project=webkit --workers=2
pnpm --filter @labui/colors exec vitest run test/button-paints.test.mjs
```

Native: `JAVA_TOOL_OPTIONS=-Djava.awt.headless=true -Dskiko.renderApi=SOFTWARE`, затем из `native/compose` — `gradlew :desktopTest --tests pics.lab.ui.DialogFamilyRenderTest --no-daemon`. Пять сценариев прошли; 22 PNG в `native/` покрывают подтверждение, темы, материалы, 100/125/200%, Dialog и Popover. OS-IME здесь не запускалась: web-регрессия использует DOM composition/keyboard events с проверкой после двух кадров.

Поведение сверено с [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing), [Floating UI flip](https://floating-ui.com/docs/flip) и [Compose intrinsic measurements](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements).

Передано общей интеграции: Acrylic-only синий участок вне верхнего левого скругления native при 200%, воспроизводимый на `native/alert-Light-Acrylic-2.0.png` и dark-варианте. Общий Colors suite имеет прежние отказы проверок Tooltip shadow/dimensions/z-index, Drag progress role и CSS system colors в forced-colors; точечная проверка авторских neutral Button paints проходит. Файлы материалов и чужие компоненты не менялись.
