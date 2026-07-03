# Интеграция цветового ядра (`@labpics/colors`)

Факты (подробности и канонический реестр пробелов — [`docs/external-deps/lab-colors.md`](docs/external-deps/lab-colors.md)):

- LabUI **потребляет** цветовое ядро; резолвер/`semantic.rs`/WASM здесь не реализуются. Единственный шов — контракт CSS-переменных с префиксом `--lab-*`; **имена переменных = контракт**, менять их нельзя.
- `@labpics/colors` **опубликован в npm** (пин `0.5.0` в [`packages/colors/package.json`](packages/colors/package.json)). Потребление идёт тремя каналами: (1) CSS-контракт — `apps/docs` импортирует `@labpics/colors/contract.css` из workspace-стаба [`packages/colors-stub`](packages/colors-stub/) (`workspace:*`); (2) живой движок — пакет [`packages/colors`](packages/colors/) (`@labui/colors`) ест опубликованный wasm по точному пину; (3) alias `labcolors-engine` в `apps/docs` — для e2e движка вживую.
- `contract.css` стаба — не рукопись, а **артефакт движка**: [`packages/colors/generate-contract.mjs`](packages/colors/generate-contract.mjs) эмитит движковые роли живьём из опубликованного пакета + паспорта, остальное — мост из замороженного Figma-якоря (`colors-stub/figma-reference.css`); дисциплину держит гейт `test/contract-generated.test.mjs`. Мост тает по мере того, как движок забирает роли; стаб исчезнет, когда мостовых ролей не останется.
- Недостающие возможности ядра фиксируются как запросы к `lab-colors`, никогда не реализуются внутри LabUI.
