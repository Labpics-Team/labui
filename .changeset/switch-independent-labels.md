---
'@labpics/ui-core': minor
'@labpics/ui-react': minor
'@labpics/ui-vue': minor
'@labpics/ui-solid': minor
'@labpics/ui-svelte': minor
'@labpics/ui-astro': minor
---

Добавлены независимые левая подпись и видимость обеих сторон Switch. Прежние
default slot и React children сохраняются. Скрытые и пустые текстовые подписи
не занимают место и не именуют input; без них используется aria-label.
SSR доставляет подписи и fallback до hydration через существующий рендерер ядра.
