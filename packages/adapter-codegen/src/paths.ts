/**
 * Пути к исходникам ядра и целям генерации — вычисляются от расположения пакета
 * codegen (`packages/adapter-codegen`), поэтому не зависят от cwd запуска.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** Корень монорепо (…/labui). */
export const repoRoot = join(here, '..', '..', '..');
/** Каталог компонентов ядра. */
export const coreComponentsDir = join(repoRoot, 'packages', 'core', 'src', 'components');
/** Путь к сгенерированному манифесту (SSOT для генераторов). */
export const manifestPath = join(here, '..', 'manifest.generated.json');
/** Каталог пакета-адаптера по имени фреймворка. */
export function adapterSrc(framework: string): string {
  return join(repoRoot, 'packages', framework, 'src');
}
