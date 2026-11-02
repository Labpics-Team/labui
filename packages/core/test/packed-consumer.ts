import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { expect } from 'vitest';

export interface PackedPackage {
  readonly directory: string;
  readonly archive?: string;
}

export async function packPackage(directory: string, destination: string): Promise<string> {
  await mkdir(destination, { recursive: true });
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('Запустите тест через pnpm, как в CI.');
  execFileSync(process.execPath, [pnpm, 'pack', '--pack-destination', destination], {
    cwd: directory,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  const archives = (await readdir(destination)).filter((file) => file.endsWith('.tgz'));
  expect(archives).toHaveLength(1);
  const archive = archives[0];
  if (!archive) throw new Error('pnpm pack не создал tarball.');
  return join(destination, archive);
}

export async function packedConsumer(
  temporary: string,
  packages: Record<string, PackedPackage>,
  evidence?: string,
) {
  const directory = join(temporary, 'consumer');
  const linked = new Set(Object.keys(packages));
  const metadata: Record<string, { exports: Record<string, unknown> }> = {};
  const artifacts: Array<{ name: string; archive: string; sha256: string }> = [];
  for (const [name, source] of Object.entries(packages)) {
    const archive =
      source.archive ?? (await packPackage(source.directory, join(temporary, 'packs', name)));
    const target = join(directory, 'node_modules', name);
    await mkdir(target, { recursive: true });
    execFileSync('tar', ['-xf', archive, '-C', target, '--strip-components=1'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    });
    const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    metadata[name] = manifest;
    for (const dependency of Object.keys({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
    })) {
      if (linked.has(dependency) || manifest.peerDependenciesMeta?.[dependency]?.optional) continue;
      const destination = join(directory, 'node_modules', dependency);
      await mkdir(dirname(destination), { recursive: true });
      await symlink(
        await realpath(join(source.directory, 'node_modules', dependency)),
        destination,
        'junction',
      );
      linked.add(dependency);
    }
    const artifact = {
      name,
      archive,
      sha256: createHash('sha256')
        .update(await readFile(archive))
        .digest('hex'),
    };
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      const saved = join(evidence, `${name.replace('/', '-')}.tgz`);
      await cp(archive, saved, { errorOnExist: true, force: false });
      artifact.archive = saved;
    }
    artifacts.push(artifact);
    console.info('packed-consumer', artifact);
  }
  if (evidence) {
    await writeFile(join(evidence, 'packages.json'), JSON.stringify(artifacts, null, 2), {
      flag: 'wx',
    });
  }
  return { directory, metadata };
}

export function ssrModules(paths: string[]) {
  // DOMshim — штатная Node-основа разрешённого Lit; renderer и hydration отделены.
  return paths.filter((path) =>
    /\/@lit-labs\/(?:ssr|ssr-client)(?:\/|$)|\/dist\/(?:ssr|hydrate)\//.test(
      path.replaceAll('\\', '/'),
    ),
  );
}

export function litModules(paths: string[]) {
  return paths.filter((path) =>
    /\/(?:lit|lit-html|lit-element|@lit|@lit-labs)\//.test(path.replaceAll('\\', '/')),
  );
}

export async function bundleConsumer(directory: string, source: string, tsconfig?: string) {
  const result = await build({
    stdin: { contents: `${source}\nglobalThis.__packedExecuted = true;`, resolveDir: directory },
    bundle: true,
    platform: 'browser',
    format: 'iife',
    minify: true,
    write: false,
    metafile: true,
    tsconfig,
  });
  const emitted = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, contribution]) => contribution.bytesInOutput > 0)
      .map(([path]) => path.replaceAll('\\', '/')),
  );
  expect(ssrModules(emitted)).toEqual([]);
  expect(emitted.filter((path) => path.includes('/@lit-labs/ssr-dom-shim/'))).toEqual([]);
  expect(result.outputFiles).toHaveLength(1);
  const output = result.outputFiles[0];
  if (!output) throw new Error('esbuild не создал bundle.');
  return { code: output.text, emitted };
}

export async function executeBrowser(
  code: string,
  inspect: (window: Window, registered: string[]) => void,
) {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true } });
  const registered: string[] = [];
  const define = window.customElements.define.bind(window.customElements);
  window.customElements.define = (name, elementClass, options) => {
    registered.push(name);
    define(name, elementClass, options);
  };
  try {
    window.eval(code);
    expect(Reflect.get(window, '__packedExecuted')).toBe(true);
    inspect(window, registered);
  } finally {
    await window.happyDOM.close();
  }
}

export function executeRequire(directory: string, source: string) {
  const script = `
const registered = [];
const definitions = new Map();
globalThis.customElements = {
  get: tag => definitions.get(tag),
  define: (tag, value) => { registered.push(tag); definitions.set(tag, value); },
};
${source}
process.stdout.write(JSON.stringify({
  result: globalThis.result,
  registered,
  lit: !!(globalThis.litHtmlVersions || globalThis.litElementVersions),
  loaded: Object.keys(require.cache),
}));
`;
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=commonjs', '-e', script], {
      cwd: directory,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20_000,
    }),
  ) as { result: unknown; registered: string[]; lit: boolean; loaded: string[] };
}
