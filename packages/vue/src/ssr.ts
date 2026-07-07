/**
 * SSR-поверхность Vue-адаптера (`@labpics/ui-vue/ssr`).
 *
 * Глубокий SSR web-компонентов — свойство @lit-labs/ssr, а не Vue: движок живёт один
 * раз в ядре. Здесь — эргономичные `renderX(props, slots)` (СГЕНЕРИРОВАНЫ, покрытие
 * всех компонентов): рендерят `<lab-*>` в declarative-shadow-DOM строку. Идиома Vue:
 *
 *   import { renderButton } from '@labpics/ui-vue/ssr';
 *   const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
 *   // в шаблоне: <div v-html="dsd"></div>
 *
 * `v-html` вставляет строку СЫРОЙ, поэтому declarative shadow DOM (`<template
 * shadowrootmode>`) доходит до браузера дословно — styled first paint без FOUC. На
 * клиенте элемент апгрейдится импортом соответствующей обёртки из `@labpics/ui-vue`
 * (или регистрации `@labpics/ui-core/<name>`).
 *
 * Низкоуровневый доступ (`html`, `renderToString`) — из `@labpics/ui-core/ssr`.
 */
export * from './generated/ssr.js';
