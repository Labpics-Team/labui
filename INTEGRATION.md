# Интеграция цветового ядра (`@labpics/colors`)

Факты (подробности и канонический реестр пробелов — [`docs/external-deps/lab-colors.md`](docs/external-deps/lab-colors.md)):

- LabUI **потребляет** цветовое ядро; резолвер/`semantic.rs`/WASM здесь не реализуются. Единственный шов — контракт CSS-переменных с префиксом `--lab-*`; **имена переменных = контракт**, менять их нельзя.
- `@labpics/colors` ещё не опубликован в npm. До публикации контракт отдаёт workspace-стаб [`packages/colors-stub`](packages/colors-stub/), видимый в workspace под именем `@labpics/colors` (`apps/docs` импортирует `@labpics/colors/contract.css`).
- Замена при публикации: перевести зависимость `@labpics/colors` со стаба на реестр и удалить `packages/colors-stub` — потребители не правятся (имена не меняются).
- Недостающие возможности ядра фиксируются как запросы к `lab-colors`, никогда не реализуются внутри LabUI.
