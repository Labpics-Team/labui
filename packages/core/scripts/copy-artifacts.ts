/**
 * Доставляет общий behavior runtime и CSS-контракты Core после сборки JS и типов.
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
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Metafile, transformSync } from 'esbuild';
import { cjsDeclarationImports } from './cjs-declaration-imports.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const dist = join(here, '..', 'dist');

// Готовый shadow.css принадлежит ui-shadow и доставляется без преобразования.
const require = createRequire(import.meta.url);
const shadowPkg = require.resolve('@labpics/ui-shadow/shadow.css');

/** Оба формата читают один CJS runtime; список exports выводится из сборки. */
function shareBehaviorRuntime(): void {
  const metadata = JSON.parse(readFileSync(join(dist, 'metafile-esm.json'), 'utf8')) as Metafile;
  for (const [file, output] of Object.entries(metadata.outputs)) {
    if (!output.entryPoint?.replaceAll('\\', '/').startsWith('src/behaviors/')) continue;
    const esm = resolve(here, '..', file);
    const withinDist = relative(dist, esm).replaceAll('\\', '/');
    if (!withinDist.startsWith('behaviors/') || !withinDist.endsWith('.js')) {
      throw new Error(`Некорректный behavior entry сборки: ${file}`);
    }
    const cjsName = `${basename(esm, '.js')}.cjs`;
    if (!existsSync(join(dirname(esm), cjsName))) {
      throw new Error(`Не найден общий runtime ${cjsName}`);
    }
    const bindings = output.exports.map((name, index) => ({ name, binding: `value${index}` }));
    const source = [
      `import behavior from ${JSON.stringify(`./${cjsName}`)};`,
      ...bindings.map(
        ({ name, binding }) => `const ${binding} = behavior[${JSON.stringify(name)}];`,
      ),
      `export { ${bindings.map(({ name, binding }) => `${binding} as ${name}`).join(', ')} };`,
    ].join('\n');
    const facade = transformSync(source, {
      format: 'esm',
      target: 'es2022',
      minify: true,
      sourcemap: 'external',
      sourcefile: `generated/${basename(esm, '.js')}-facade.js`,
    });
    writeFileSync(esm, `${facade.code}//# sourceMappingURL=${basename(esm)}.map\n`);
    writeFileSync(`${esm}.map`, facade.map);
  }
}

/** TS 5.7 разрешает ESM-типы из CJS через явный resolution-mode, включая Lit. */
function copyCjsDeclarationImports(): void {
  for (const name of readdirSync(dist, { recursive: true, encoding: 'utf8' })) {
    if (!name.endsWith('.d.cts')) continue;
    const file = join(dist, name);
    const source = readFileSync(file, 'utf8');
    const declaration = cjsDeclarationImports(file, source);
    if (source !== declaration) writeFileSync(file, declaration);
  }
}

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
  shareBehaviorRuntime();
  copyCjsDeclarationImports();

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
