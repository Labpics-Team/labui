/**
 * Доставляет CSS-контракты Core и shadow в dist после сборки JS и типов.
 * Лицензии включённых зависимостей выводятся из фактического графа сборки.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const dist = join(here, '..', 'dist');

// Готовый shadow.css принадлежит ui-shadow и доставляется без преобразования.
const require = createRequire(import.meta.url);
const shadowPkg = require.resolve('@labpics/ui-shadow/shadow.css');

/** Лицензии выводятся из фактических bundle inputs, без второго списка зависимостей. */
function copyBundledLicenses(): void {
  const notices = new Map<string, string>();
  for (const format of ['esm', 'cjs']) {
    const metadataPath = join(dist, `metafile-${format}.json`);
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as {
      inputs: Record<string, unknown>;
    };
    for (const input of Object.keys(metadata.inputs)) {
      if (!input.replaceAll('\\', '/').includes('node_modules/')) continue;
      let directory = dirname(resolve(here, '..', input));
      while (!existsSync(join(directory, 'package.json'))) {
        const parent = dirname(directory);
        if (parent === directory) throw new Error(`Не найден пакет, которому принадлежит ${input}`);
        directory = parent;
      }
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as {
        name: string;
        version: string;
      };
      const identity = `${manifest.name}@${manifest.version}`;
      if (notices.has(identity)) continue;
      const licenses = readdirSync(directory)
        .filter((file) => /^(?:licen[cs]e|copying)(?:[.-]|$)/i.test(file))
        .sort();
      if (!licenses.length)
        throw new Error(`Не найдена лицензия включённой зависимости ${identity}`);
      notices.set(
        identity,
        `${identity}\n${licenses.map((file) => readFileSync(join(directory, file), 'utf8')).join('\n')}`,
      );
    }
    // Метаданные нужны сборщику; tarball получает тексты лицензий.
    unlinkSync(metadataPath);
  }
  writeFileSync(
    join(dist, 'THIRD-PARTY-NOTICES.txt'),
    [...notices]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, notice]) => notice)
      .join('\n\n'),
  );
}

function main(): void {
  mkdirSync(dist, { recursive: true });

  // Контракты темы и браузерного выделения принадлежат Core.
  const ownFiles = ['theme.css', 'selection.css'];
  for (const file of ownFiles) {
    copyFileSync(join(src, file), join(dist, file));
  }

  // Публичный shadow.css сохраняет контракт владельца ui-shadow.
  copyFileSync(shadowPkg, join(dist, 'shadow.css'));
  copyBundledLicenses();

  process.stdout.write(`ui-core: copied ${[...ownFiles, 'shadow.css'].join(', ')} to dist\n`);
}

main();
