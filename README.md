# labui

LabUI — дизайн-система Labpics: web components ядро (`packages/core`) + адаптеры react/vue/svelte/solid/astro + контракт токенов (colors/tokens/shadow/materials/fonts) + docs-приложение с Playwright-гейтами (`apps/docs`).

```sh
pnpm install --ignore-scripts
pnpm rebuild @biomejs/biome esbuild
pnpm build          # все пакеты
pnpm typecheck
pnpm test           # unit-гейты всех пакетов
pnpm check          # biome lint + format
pnpm test:e2e       # playwright (apps/docs)
```
