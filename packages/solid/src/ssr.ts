/**
 * SSR-поверхность Solid-адаптера (`@labpics/ui-solid/ssr`).
 *
 * Эргономичные `renderX(props, slots)` (СГЕНЕРИРОВАНЫ, покрытие всех компонентов):
 * рендерят `<lab-*>` в declarative-shadow-DOM строку. Идиома Solid — внедрение через
 * `innerHTML` (СЫРАЯ вставка, в отличие от textContent, который экранирует):
 *
 *   import { renderButton } from '@labpics/ui-solid/ssr';
 *   const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
 *   // в разметке: <div innerHTML={dsd} />
 *
 * `<template shadowrootmode>` доходит до браузера дословно — styled first paint без
 * FOUC. На клиенте элемент апгрейдится импортом обёртки из `@labpics/ui-solid` (или
 * регистрации `@labpics/ui-core/<name>`).
 */
export * from './generated/ssr.js';
