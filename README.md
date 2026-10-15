# Lab UI

Дизайн-система Labpics: компоненты интерфейса, темы и токены. Поведение
компонентов реализовано в Web Components. Адаптеры связывают их с React,
Vue, Svelte, Solid и Astro.

## Открыть каталог

Из корня репозитория нужен pnpm версии, закреплённой в
[package.json](package.json):

```sh
pnpm install --frozen-lockfile
pnpm --filter @labpics/ui-docs dev
```

Команда запускает локальный каталог компонентов из `apps/docs`.
Для отдельной сборки каталога используйте
`pnpm --filter @labpics/ui-docs build`.

## Где менять компонент

- [Ядро](packages/core/): компоненты, состояния, Web Components и
  серверный рендеринг.
- [Адаптеры](packages/react/), [Vue](packages/vue/),
  [Svelte](packages/svelte/), [Solid](packages/solid/) и
  [Astro](packages/astro/): привязки платформ.
- [Токены](packages/tokens/), [цвет](packages/colors/),
  [тени](packages/shadow/), [материалы](packages/materials/)
  и [шрифты](packages/fonts/): общие значения оформления.
- [Генерация адаптеров](packages/adapter-codegen/): исходники
  повторяющихся платформенных привязок.
- [Каталог](apps/docs/): примеры, документация интерфейса
  и браузерные проверки.

Смысл состояния и поведение компонента меняйте у его владельца в ядре.
Оформление должно использовать существующие токены. Пример в каталоге
показывает компонент, сохраняя его реальную композицию и состояния.

## Проверить изменение

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm check
pnpm test:e2e
```

`pnpm check` запускает Biome; `pnpm test` выполняет тесты пакетов.
`pnpm test:e2e` запускает Playwright для каталога. Для первого
браузерного запуска потребуется установить поддерживаемые браузеры
Playwright на своей машине.

В CI выполняются выбранные smoke-сценарии; полный набор браузерных
проверок запускается отдельно. Их состав определяют
[настройка Playwright](apps/docs/playwright.config.ts) и
[workflow](.github/workflows/ci.yml).

Для оформления изменения версии используйте существующий
[Changesets](.changeset/) и команду `pnpm changeset`, если изменение
затрагивает публикуемый пакет.
