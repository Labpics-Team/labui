/**
 * SSR-поверхность Astro-адаптера (`@labpics/ui-astro/ssr`, он же корень пакета).
 *
 * Эргономичные `renderX(props, slots)` (СГЕНЕРИРОВАНЫ, покрытие всех компонентов):
 * рендерят `<lab-*>` в declarative-shadow-DOM строку. Их зовут `.astro`-компоненты и
 * внедряют через `set:html`. Экспортируем отсюда и для прямого программного доступа.
 *
 * `@astrojs/lit` УСТАРЕЛ на Astro 5 (офиц. доки), поэтому интеграция — ручной рецепт
 * Lit SSR: server → DSD-строка → set:html; client `<script>` → hydrate-support +
 * регистрация элемента (см. сгенерированные `src/astro/*.astro`).
 */
export * from './generated/ssr.js';
