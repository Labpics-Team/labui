# labui

LabUI — дизайн-система Labpics: web components ядро (`packages/core`) + адаптеры react/vue/svelte/solid/astro + контракт токенов (colors/tokens/shadow/materials/fonts) + docs-приложение с Playwright-гейтами (`apps/docs`).

```sh
pnpm install
pnpm build          # все пакеты
pnpm typecheck
pnpm test           # unit-гейты всех пакетов
pnpm check          # biome lint + format
pnpm test:e2e       # playwright (apps/docs)
```

Порталы сохраняют ближайшие скоупы `data-theme` и `data-material` своего контрола и следуют их изменениям. Правило переноса принадлежит [модулю темы ядра](packages/core/src/theme.ts): Чистый entrypoint `@labpics/ui-core/theme` предоставляет `bindPortalScope(source, target)`, который возвращает функцию завершения привязки. Lit dialog и общий React-адаптер портала владеют её сроком жизни; остальные renderer-компоненты передают только DOM-источник. При отсутствии явной темы продолжает работать CSS-предпочтение ОС.
