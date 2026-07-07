/**
 * SSR-поверхность Svelte-адаптера (`@labpics/ui-svelte/ssr`).
 *
 * Эргономичные `renderX(props, slots)` (СГЕНЕРИРОВАНЫ, покрытие всех компонентов):
 * рендерят `<lab-*>` в declarative-shadow-DOM строку. Идиома Svelte — внедрение через
 * `{@html}` (СЫРАЯ вставка):
 *
 *   import { renderButton } from '@labpics/ui-svelte/ssr';
 *   const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
 *   // в разметке: {@html dsd}
 *
 * `<template shadowrootmode>` доходит до браузера дословно — styled first paint без
 * FOUC. На клиенте элемент апгрейдится импортом обёртки из `@labpics/ui-svelte` (или
 * регистрации `@labpics/ui-core/<name>`).
 */
export * from './generated/ssr.js';
//# sourceMappingURL=ssr.d.ts.map