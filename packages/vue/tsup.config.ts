import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libraryPreset } from '../../tsup.config.base';

const here = dirname(fileURLToPath(import.meta.url));
const genDir = join(here, 'src', 'generated');

/**
 * Per-component входы, АВТО-обнаруженные из `src/generated/<name>.ts` (барель
 * `index.ts` исключён — он идёт как основной вход). Каждый компонент — свой вход,
 * чтобы потребитель мог импортировать `@labpics/ui-vue/<name>` и подтянуть только его
 * (tree-shaking-шов, как в @labpics/ui-react). Добавление компонента здесь правок не
 * требует — генерация кладёт файл, а этот дискавери его подхватывает.
 */
const componentEntries = Object.fromEntries(
  readdirSync(genDir)
    // Только клиентские обёртки: барели (index/ssr) и SSR-функции (*.ssr.ts) идут
    // отдельными входами (index/ssr) — не дублируем их per-component.
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.ssr.ts') &&
        file !== 'index.ts' &&
        file !== 'ssr.ts',
    )
    .map((file) => [file.slice(0, -'.ts'.length), `src/generated/${file}`]),
);

export default libraryPreset({
  entry: {
    index: 'src/index.ts',
    ssr: 'src/ssr.ts',
    ...componentEntries,
  },
  // Каждый per-component вход самодостаточен (общая фабрика инлайнится) — импорт одного
  // компонента не тащит остальные. Обёртки тонкие, дублирование фабрики ничтожно.
  splitting: false,
  // Vue и Lit-ядро — внешние: приложение потребителя владеет Vue, а рантайм <lab-*>
  // резолвится один раз из @labpics/ui-core. Side-effect импорт регистрации переживает
  // tree-shaking через `sideEffects` в package.json.
  external: ['vue', /^@labpics\//],
});
