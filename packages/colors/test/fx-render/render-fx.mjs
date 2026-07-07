// Standalone-драйвер FX-render гейта: рендерит харнесс в браузере, сохраняет
// PNG-артефакт для владельца и прогоняет ОБЪЕКТИВНЫЕ инварианты (кидает при RED).
//
// Запуск:
//   node test/fx-render/render-fx.mjs                    # зелёный прогон + артефакт
//   node test/fx-render/render-fx.mjs --flatten          # bite: ступени сплющены → RED
//   node test/fx-render/render-fx.mjs --drop=success     # bite: glow-токен убран → RED
//   node test/fx-render/render-fx.mjs --drop-focus=success  # bite: focus-ring убран → RED
//   node test/fx-render/render-fx.mjs --skeleton=flatten    # bite: блик==resting → RED
//   node test/fx-render/render-fx.mjs --skeleton=invert     # bite: Figma-инверсия → RED
//
// chromium берём из @labpics/ui-docs-стора (@playwright/test) по абсолютному
// пути — пакет colors не тянет playwright как зависимость (гейт живёт в e2e-джобе,
// у `pnpm test` браузеров нет). Путь резолвим глобом по .pnpm — переживает бамп версии.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

import { assertFxRender, renderAndMeasure } from './fx-gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..'); // packages/colors/test/fx-render → repo
const contractPath = join(repoRoot, 'packages', 'colors-stub', 'contract.css');
// Каталог вывода gitignored (см. .gitignore: packages/colors/artifacts/) — это
// эфемерное доказательство для владельца, а не исходник. Бинарь-PNG в git
// недопустим (раздувает пакет colors); в CI этот PNG отдаётся как artifact
// workflow (upload-artifact), а локально просто перезаписывается на месте.
const artifactDir = join(repoRoot, 'packages', 'colors', 'artifacts', 'fx-render');

/** Числовой semver-ключ из имени .pnpm-папки '@playwright+test@1.55.1(...)'. */
function pwVersionKey(entry) {
  const m = entry.match(/@playwright\+test@(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/** Резолв @playwright/test из pnpm-стора (без зависимости в этом пакете). */
async function loadChromium() {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const entries = readdirSync(pnpmDir).filter((e) => e.startsWith('@playwright+test@'));
  if (entries.length === 0) throw new Error('@playwright/test не найден в node_modules/.pnpm');
  // Берём наибольшую версию по ЧИСЛОВОМУ semver (лексикографика путала бы
  // 1.9.0 > 1.10.0). При одной версии в сторе выбор тривиален, но сравнение
  // корректно и когда их несколько (напр. после бампа @playwright/test).
  entries.sort((a, b) => {
    const [ma, na, pa] = pwVersionKey(a);
    const [mb, nb, pb] = pwVersionKey(b);
    return ma - mb || na - nb || pa - pb;
  });
  const pkg = join(
    pnpmDir,
    entries[entries.length - 1],
    'node_modules',
    '@playwright',
    'test',
    'index.mjs',
  );
  const mod = await import(pathToFileURL(pkg).href);
  return mod.chromium;
}

async function main() {
  const args = process.argv.slice(2);
  const flatten = args.includes('--flatten');
  const dropArg = args.find((a) => a.startsWith('--drop='));
  const dropGlow = dropArg ? dropArg.slice('--drop='.length) : null;
  const dropFocusArg = args.find((a) => a.startsWith('--drop-focus='));
  const dropFocus = dropFocusArg ? dropFocusArg.slice('--drop-focus='.length) : null;
  const skelArg = args.find((a) => a.startsWith('--skeleton='));
  const skeletonBite = skelArg ? skelArg.slice('--skeleton='.length) : null;
  const bite = flatten || dropGlow || dropFocus || skeletonBite;

  const contractCss = readFileSync(contractPath, 'utf8');
  const chromium = await loadChromium();

  const { png, measurements } = await renderAndMeasure(chromium, contractCss, {
    flatten,
    dropGlow,
    dropFocus,
    skeletonBite,
  });

  // Артефакт для владельца — сохраняем ВСЕГДА (в т.ч. в bite-прогоне: наглядно
  // видно, что glow/focus-ring пропал или сплющился), но красим отдельно по гейту.
  mkdirSync(artifactDir, { recursive: true });
  const suffix = flatten
    ? '-flatten'
    : dropGlow
      ? `-drop-${dropGlow}`
      : dropFocus
        ? `-drop-focus-${dropFocus}`
        : skeletonBite
          ? `-skeleton-${skeletonBite}`
          : '';
  const pngPath = join(artifactDir, `fx-render${suffix}.png`);
  writeFileSync(pngPath, png);

  // Компактный measurements.json (без сырых RGB-объектов focus для читаемости).
  const summary = {
    backdropL: Number(measurements.backdropL.toFixed(3)),
    glowDeltaFromBackdrop: Object.fromEntries(
      Object.entries(measurements.glow).map(([s, g]) => [
        s,
        {
          subtle: Number((g.subtle.L - measurements.backdropL).toFixed(3)),
          base: Number((g.base.L - measurements.backdropL).toFixed(3)),
          bloom: Number((g.bloom.L - measurements.backdropL).toFixed(3)),
        },
      ]),
    ),
    focusRing: Object.fromEntries(
      Object.entries(measurements.focus).map(([s, f]) => [
        s,
        { r: Math.round(f.r), g: Math.round(f.g), b: Math.round(f.b), L: Number(f.L.toFixed(2)) },
      ]),
    ),
    skeleton: {
      base: Number(measurements.skeleton.base.L.toFixed(2)),
      highlight: Number(measurements.skeleton.highlight.L.toFixed(2)),
      lift: Number((measurements.skeleton.highlight.L - measurements.skeleton.base.L).toFixed(2)),
    },
    mutation: flatten
      ? 'flatten'
      : dropGlow
        ? `drop:${dropGlow}`
        : dropFocus
          ? `drop-focus:${dropFocus}`
          : skeletonBite
            ? `skeleton:${skeletonBite}`
            : 'none',
  };
  // Трейлинг-newline: Biome format-check требует финальный перевод строки в JSON.
  writeFileSync(
    join(artifactDir, `measurements${suffix}.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.info(`PNG-артефакт: ${pngPath}`);
  console.info('Замеры (glow luminance-delta над фоном):');
  for (const [s, d] of Object.entries(summary.glowDeltaFromBackdrop)) {
    console.info(`  ${s.padEnd(8)} subtle=${d.subtle}  base=${d.base}  bloom=${d.bloom}`);
  }
  console.info(
    `Скелетон (luminance): base=${summary.skeleton.base} highlight=${summary.skeleton.highlight} lift=${summary.skeleton.lift}`,
  );

  try {
    assertFxRender(measurements);
    if (bite) {
      console.error('\n❌ BITE-ПРОВАЛ: мутация НЕ покраснела — гейт не кусается!');
      process.exit(2);
    }
    console.info(
      '\n✅ FX-render гейт ЗЕЛЁНЫЙ: glow 6 сентиментов non-blank+монотонны, focus-ring non-blank.',
    );
  } catch (err) {
    if (bite) {
      console.info(`\n✅ BITE подтверждён (мутация → RED, как и должно):\n${err.message}`);
      process.exit(0);
    }
    console.error(`\n${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
