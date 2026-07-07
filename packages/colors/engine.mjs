// Инициализация движка в node: wasm-байты читаются с диска (web-target
// пакета тянет fetch только для URL — байты работают и в node, и в тестах).
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** Поднять движок с загруженным паспортом labui; вернуть { colors, fingerprint }. */
export async function createLabuiEngine() {
  const pkgEntry = require.resolve('@labpics/colors');
  const pkgDir = dirname(pkgEntry);
  const mod = await import('@labpics/colors');
  const wasm = await readFile(join(pkgDir, 'pkg', 'labcolors_bg.wasm'));
  await mod.default({ module_or_path: wasm });
  const colors = new mod.LabColors();
  const config = JSON.parse(await readFile(join(here, 'labui.config.json'), 'utf8'));
  // Компонентный слой (юзкейсы-переназначения, напр. пары бейджа — закон пары
  // ядра) на диске отделён от семантики (гигиена трёх уровней). Ядро его как
  // ключ не знает, потому складываем его роли в roles ПЕРЕД loadConfig: движок
  // видит единый набор и вычисляет их идентично, а паспорт держит слои раздельно.
  if (Array.isArray(config.components)) {
    config.roles = [...config.roles, ...config.components];
    delete config.components;
  }
  const fingerprint = colors.loadConfig(JSON.stringify(config));
  return { colors, fingerprint };
}

/** Пин отпечатка паспорта (см. README): дрейф конфига виден по несовпадению. */
export const PASSPORT_FINGERPRINT = '221af542b654dd43';
