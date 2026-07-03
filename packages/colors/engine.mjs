// Инициализация движка в node: wasm-байты читаются с диска (web-target
// пакета тянет fetch только для URL — байты работают и в node, и в тестах).
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** Полный паспорт: словарь ролей/алиасов выписан целиком — ЭТАЛОН тождества,
 *  грузится любым движком (включая опубликованный 0.5.0). */
export const FULL_PASSPORT_PATH = join(here, 'labui.config.json');
/** Тонкий паспорт (BL-007): roles/aliases опущены, движок раскрывает их
 *  пресетом «labui». Требует пресет-способного движка (@labpics/colors ≥0.6). */
export const THIN_PASSPORT_PATH = join(here, 'labui.config.thin.json');

/** Поднять движок с загруженным паспортом labui; вернуть { colors, fingerprint }.
 *  По умолчанию — ПОЛНЫЙ паспорт: он грузится на любом движке, поэтому боевой
 *  гейт золота остаётся зелёным и на опубликованном 0.5.0. */
export async function createLabuiEngine(passportPath = FULL_PASSPORT_PATH) {
  const pkgEntry = require.resolve('@labpics/colors');
  const pkgDir = dirname(pkgEntry);
  const mod = await import('@labpics/colors');
  const wasm = await readFile(join(pkgDir, 'pkg', 'labcolors_bg.wasm'));
  await mod.default({ module_or_path: wasm });
  const colors = new mod.LabColors();
  const passport = await readFile(passportPath, 'utf8');
  const fingerprint = colors.loadConfig(passport);
  return { colors, fingerprint };
}

/** Сигнатура отказа ПРЕ-пресетного движка: конфиг с пресетом отвергается,
 *  т.к. движок всё ещё требует раскрытый словарь (serde сообщает первое
 *  опущенное поле). Опубликованный 0.5.0 бросает
 *  «invalid_config: … missing field `roles` …». Пресет-способный движок (≥0.6)
 *  тонкий паспорт ГРУЗИТ и в эту ветку не попадает — потому точная сигнатура,
 *  а не любой invalid_config: реально сломанный тонкий паспорт на ≥0.6 дал бы
 *  иную ошибку и обязан упасть, а не быть молча пропущенным. */
export function isPresetUnsupported(err) {
  const msg = String(err?.message ?? err);
  return /invalid_config/i.test(msg) && /missing field/i.test(msg) && /(roles|aliases)/i.test(msg);
}

/** Версия разрешённого движка @labpics/colors (из его package.json). */
export async function engineVersion() {
  const pkgPath = join(dirname(require.resolve('@labpics/colors')), 'package.json');
  const { version } = JSON.parse(await readFile(pkgPath, 'utf8'));
  return version;
}

/** Пре-пресетная линия (<0.6): пресеты появляются с 0.6.0. */
function isPrePresetVersion(version) {
  const [major, minor] = String(version).split('.').map(Number);
  return major === 0 && minor < 6;
}

let presetSupport;
/** Фиче-детект: понимает ли слинкованный движок тонкий (пресетный) паспорт?
 *  Успех загрузки тонкого → true (в т.ч. dev-сборка ветки с версией 0.5.0, но
 *  уже пресет-способная). Отказ пропускаем в false ТОЛЬКО когда движок пре-
 *  пресетный (<0.6) И ошибка несёт известную сигнатуру опущенного словаря. На
 *  ЛЮБОМ движке ≥0.6 отказ загрузки тонкого — реальный баг: пробрасываем (RED),
 *  чтобы сломанный пресет-движок не был молча замаскирован под «нет пресетов».
 *  Мемоизация на процесс — детект зовут и тесты, и генератор. */
export async function engineSupportsPreset() {
  if (presetSupport === undefined) {
    presetSupport = createLabuiEngine(THIN_PASSPORT_PATH)
      .then(() => true)
      .catch(async (err) => {
        const prePreset = isPrePresetVersion(await engineVersion());
        if (prePreset && isPresetUnsupported(err)) return false;
        throw err;
      });
  }
  return presetSupport;
}

/** Пин отпечатка паспорта (см. README): дрейф конфига виден по несовпадению.
 *  Тонкий и полный дают ОДИН отпечаток по построению (пресет раскрывает тот же
 *  словарь ролей) — тождество доказывает test/thin-identity.test.mjs. */
export const PASSPORT_FINGERPRINT = '31b89f156aafb518';
