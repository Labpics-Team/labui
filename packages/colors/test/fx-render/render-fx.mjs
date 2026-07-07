// Standalone-драйвер FX-render гейта: рендерит харнесс в браузере, сохраняет
// PNG-артефакт для владельца и прогоняет ОБЪЕКТИВНЫЕ инварианты (кидает при RED).
//
// Запуск:
//   node test/fx-render/render-fx.mjs            # зелёный прогон + артефакт
//   node test/fx-render/render-fx.mjs --flatten  # bite: ступени сплющены → RED
//   node test/fx-render/render-fx.mjs --drop=success  # bite: токен убран → RED
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
const artifactDir = join(repoRoot, 'packages', 'colors', 'artifacts', 'fx-render');

/** Резолв @playwright/test из pnpm-стора (без зависимости в этом пакете). */
async function loadChromium() {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const entries = readdirSync(pnpmDir).filter((e) => e.startsWith('@playwright+test@'));
  if (entries.length === 0) throw new Error('@playwright/test не найден в node_modules/.pnpm');
  // Берём наибольшую версию (лексикографически достаточно для major-стабильности).
  entries.sort();
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
  const bite = flatten || dropGlow;

  const contractCss = readFileSync(contractPath, 'utf8');
  const chromium = await loadChromium();

  const { png, measurements } = await renderAndMeasure(chromium, contractCss, {
    flatten,
    dropGlow,
  });

  // Артефакт для владельца — сохраняем ВСЕГДА (в т.ч. в bite-прогоне: наглядно
  // видно, что glow пропал/сплющился), но красим отдельно по гейту.
  mkdirSync(artifactDir, { recursive: true });
  const suffix = flatten ? '-flatten' : dropGlow ? `-drop-${dropGlow}` : '';
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
    mutation: flatten ? 'flatten' : dropGlow ? `drop:${dropGlow}` : 'none',
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

  try {
    assertFxRender(measurements);
    if (bite) {
      console.error('\n❌ BITE-ПРОВАЛ: мутация НЕ покраснела — гейт не кусается!');
      process.exit(2);
    }
    console.info(
      '\n✅ FX-render гейт ЗЕЛЁНЫЙ: 6 сентиментов non-blank+различимы, ступени монотонны.',
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
