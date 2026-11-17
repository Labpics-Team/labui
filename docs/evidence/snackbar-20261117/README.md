# Snackbar — источник и исполнение

17 ноября прочитаны неизменённые Figma masters Snackbar 6109:6735,
его тёмный instance 7101:54738 и пять timer poses 6109:6708.
`figma-source.json` содержит анатомию, paints, эффекты, привязки и переменные;
`figma-*.svg/png` — прямые экспорты, без изменений исходной сцены.

Общий профиль в `packages/tokens/src/components.json`: capsule, Elevated,
padding start/end/y 12/8/8, action gap 24, label gap 12, Geist 16/24/500.
Таймер 32 px с внутренним stroke 3 px, дуги 360/270/225/135/75°.
Последние две секунды используют danger. Действие — существующий small
accent/ghost Button, не отдельная стилизация. С ним высота равна 52 px.

Lit/React используют один CSS и один runtime. Отсчёт обновляет текст и дугу
на границах секунды/позы, без кадрового цикла; focus/hover/hidden приостанавливают
остаток. `duration=0` постоянен. Новая notificationKey перезапускает тот же DOM.
Announcer отделён от декоративного таймера. Cleanup снимает deadline, listeners,
Motion scope и материал. Snapshot Lit accessor-properties сделан явно;
обновление цифры сохраняет маркеры Lit и текстовый узел React.

Headless Chromium/WebKit проверяют анатомию, пять поз, сохранение фокуса,
hover+focus, повторный результат, действие, постоянное сообщение, hidden-document
event, disposal и длинный текст. Первый сценарий сохраняет настройки, отменяет
последнее сохранение и проверяет отмену после reload. ESM/CJS Node-import и
React SSR проходят. Tokens: 114 тестов PASS.

Итоговый production build Core → React → Docs: PASS. На preview 4328:
22 Snackbar + 8 сценарных проверок Chromium/WebKit — 30 PASS; typecheck
трёх пакетов — PASS; ESM/CJS import + SSR — 2 PASS. Снимки ниже сняты
с этой же production-сборки. Команда: `PW_PORT=4328 pnpm --filter
@labpics/ui-docs exec playwright test tests/snackbar.spec.ts
tests/experience.spec.ts --workers=2` (переменная задаётся средствами shell).

Production-проверка обнаружила удаление регистрации вложенного Button:
в dev `customElements.get('lab-button')` был определён, в preview — нет.
Core переносит её в общий chunk, поэтому `sideEffects` сохраняет также
`dist/chunk-*.js/cjs`. После исправления обе реализации показывают кнопку,
имеют высоту 52 px и выполняют Undo. Поведение поля описано в
[esbuild API](https://esbuild.github.io/api/#ignore-annotations).

Независимое ревью нашло недопустимый `transform` в публичном Motion 0.5.0:
ошибка шла через callback и оставляла смещение 8 px. Исправлено на `y: [8, 0]`,
как в публичном README Motion. Проверки теперь наблюдают `lab-error` и React
`onRuntimeError`, конечное положение обычного движения и немедленный итог
reduced motion. Consumer experience передаёт неожиданный сбой в `reportError`.

`apps/docs/tests/snackbar-render.mjs` сохраняет обе реализации в двух темах
и трёх материалах. Высота в render.json — 52 px. Ширина текущего текста в web
344.14 px; ширина Figma master — 349 px (dark instance 346 px). Интринсик-текст
не растянут вручную; различие метрик набора сохраняется как открытое наблюдение.
Повторная независимая проверка исправления Motion ещё не выполнена. Оптическое доведение общих Glass
материалов продолжается отдельно; эти снимки не объявляют его завершённым.

Никаких окон или звука на компьютере пользователя. Figma читалась через
установленный Desktop Bridge Server/Connector напрямую: закрытый stdio MCP
не потребовал менять файл или перезапускать приложение.
