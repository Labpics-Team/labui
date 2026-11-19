# Native framework SSR — 19 ноября 2026

Исполняемая проверка: [framework-ssr-packed.mjs](../../../apps/docs/tests/framework-ssr-packed.mjs).
Результаты, SHA-256 восьми установленных tarballs и клиентские SSR-провайдеры:
[result.json](result.json). PNG показывают приложение после гидратации и обновлений.

Потребитель устанавливается во временную папку вне workspace. Vue использует
официально скомпилированные SFC, включая вложенный Editor; Solid — собственный
`renderToString`/`hydrate`, Svelte — скомпилированные компоненты и snippets.
Серверные package exports проверены через Node ESM, CJS (Vue/Solid) и Vite SSR.
Клиентская сборка не содержит server renderer и исходных workspace aliases.

Для Vue, Solid и Svelte в Chromium и WebKit подтверждено:

- До регистрации custom elements видны стилизованные вкладки, выбранная панель
  и серверное значение Textarea.
- Все шесть host-элементов, shadow trigger/panel и интерактивные light-DOM узлы
  сохраняются при гидратации. Ошибок и hydration mismatch нет.
- Текст и выделение, изменённые до JavaScript, сохраняются в обычном textarea и
  `LabTextarea`. Изменение readonly не повторяет прежний value; новый controlled
  value применяется без замены внутреннего textarea.
- Native click и custom events вызывают обработчики framework; label обновляется
  реактивно. Массивы, явный null, false при default true и пропущенный prop
  сохраняют смысл.

Проверки исходников: core 83, Vue 10, Solid 14, Svelte 14 и codegen 32 теста;
typecheck четырёх пакетов; Biome и `git diff --check`. Installed TypeScript
проверяет новый core-вход в ESM/CJS, `svelte-check` — допустимый snippet и ошибку
при передаче строки. Версии framework: Vue 3.5.42, Solid 1.9.4, Svelte 5.19.0.

Это проверка обычных адаптеров, а не только строковых `/ssr` helpers. Полный
Nuxt/SolidStart/SvelteKit shell, streaming и closed shadow roots здесь не заявлены.
Настройка и первоисточники: [framework-ssr.md](../../reference/framework-ssr.md).
