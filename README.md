# Lab UI

Дизайн-система Labpics: компоненты интерфейса, темы и токены. Поведение
компонентов реализовано в Web Components. Адаптеры связывают их с React,
Vue, Svelte, Solid и Astro.

## Открыть каталог

Из корня репозитория нужен pnpm версии, закреплённой в
[package.json](package.json):

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @labpics/ui-docs dev
```

Команда запускает локальный каталог компонентов из `apps/docs`.
Для отдельной сборки каталога после `pnpm build` используйте
`pnpm --filter @labpics/ui-docs build`.

## Где менять компонент

[Карта пакетов](docs/README.md) показывает владельцев компонентов,
токенов, адаптеров и каталога примеров.

## Проверить изменение

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm check
pnpm test:e2e
```

`pnpm check` запускает Biome; `pnpm test` выполняет тесты пакетов.
Пакеты проверяются по очереди; параллельными файлами управляет их
тестовый раннер. Ошибка одного пакета не скрывает результаты остальных;
общий запуск остаётся неуспешным.

`pnpm test:e2e` запускает Playwright для каталога. Для первого
браузерного запуска потребуется установить поддерживаемые браузеры
Playwright на своей машине.

В CI выполняются выбранные smoke-сценарии; полный набор браузерных
проверок запускается отдельно. Их состав определяют
[настройка Playwright](apps/docs/playwright.config.ts) и
[smoke-workflow](.github/workflows/ci.yml) и
[workflow полного прогона](.github/workflows/e2e-full.yml).

Для оформления изменения версии используйте существующий
[Changesets](.changeset/) и команду `pnpm changeset`, если изменение
затрагивает публикуемый пакет.

