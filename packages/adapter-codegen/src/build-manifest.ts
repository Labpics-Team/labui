/**
 * Строит {@link Manifest} из ядра и пишет его в `manifest.generated.json` (SSOT).
 * Экспортирует {@link buildManifest} для тестов/генераторов и запускается как CLI.
 */
import { writeFileSync } from 'node:fs';
import { analyzeCore } from './analyze.js';
import { coreComponentsDir, manifestPath } from './paths.js';
import type { Manifest } from './types.js';

/** Анализирует ядро и возвращает манифест (чистая функция, для тестов). */
export function buildManifest(): Manifest {
  return analyzeCore(coreComponentsDir);
}

/** Сериализует манифест в детерминированный JSON (стабильный diff). */
export function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function main(): void {
  const manifest = buildManifest();
  writeFileSync(manifestPath, serializeManifest(manifest));
  const total = manifest.components.length;
  const withEvents = manifest.components.filter((c) => c.events.length > 0).length;
  process.stdout.write(`манифест: ${total} компонентов, ${withEvents} с событиями\n`);
  for (const c of manifest.components) {
    const slots = [
      c.slots.default ? 'default' : '',
      ...c.slots.named,
      c.slots.dynamic ? '§dynamic' : '',
    ]
      .filter(Boolean)
      .join(',');
    process.stdout.write(
      `  ${c.tag}: props=${c.props.length} events=[${c.events.join(',')}] slots=[${slots}]\n`,
    );
  }
}

// Запуск как скрипт (tsx src/build-manifest.ts).
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('build-manifest.ts')
) {
  main();
}
