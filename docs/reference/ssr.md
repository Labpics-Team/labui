# Серверный рендеринг

`@labpics/ui-core/ssr` устанавливает минимальные DOM API синхронно, сохраняя
существующий `customElements` и зарегистрированные элементы. После завершения
импорта доступны синхронные `renderToString` и функции `renderX` веб-адаптеров.
Их результат содержит declarative shadow DOM до подключения JavaScript.

Используется `installWindowOnGlobal` из поставляемого subpath
`@lit-labs/ssr/lib/dom-shim.js` версии 4.1.0. У пакета нет ограничения `exports`,
каталог `lib` входит в опубликованные файлы. Передача существующего реестра
через штатный `props` сохраняет его и при отсутствии `window` self-reference
в минимальном DOM этой версии.

`install-global-dom-shim.js` той же версии сначала ждёт проверку CSS imports.
Его top-level await позволяет соседним статическим импортам компонентов
выполниться до установки DOM и пропустить регистрацию. LabUI использует
CSS-строки и файлы: CSS module loader остаётся настройкой приложения,
серверный bootstrap LabUI не устанавливает этот необязательный hook.

Проверка `apps/docs/tests/kbd.spec.ts` запускает собранный SSR-адаптер в новом
Node-процессе, проверяет сохранение предварительно установленного реестра,
затем гидратирует DSD и обновляет компонент в Chromium и WebKit.

Первичный источник: [DOM shim 4.1.0](https://unpkg.com/@lit-labs/ssr@4.1.0/lib/dom-shim.js),
[асинхронная установка](https://unpkg.com/@lit-labs/ssr@4.1.0/lib/install-global-dom-shim.js).
