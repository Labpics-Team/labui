import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CatalogRegistry, NativeApi, ProfileSourceRef } from '../../../catalog/types.js';
import {
  buildCatalog,
  catalogMain,
  discoverNative,
  validateProfileSources,
  validatePublicMetadata,
  validateSourceCache,
} from '../src/catalog.js';
import { repoRoot } from '../src/paths.js';

const registry = JSON.parse(
  readFileSync(join(repoRoot, 'catalog/registry.json'), 'utf8'),
) as CatalogRegistry;
const native = JSON.parse(
  readFileSync(join(repoRoot, 'catalog/native-api.generated.json'), 'utf8'),
) as NativeApi;
const profiles = JSON.parse(
  readFileSync(join(repoRoot, 'packages/tokens/src/components.json'), 'utf8'),
);
const temporary = mkdtempSync(join(tmpdir(), 'labui-catalog-'));
afterAll(() => rmSync(temporary, { recursive: true, force: true }));

describe('semantic catalog joined to real API and documentation', () => {
  it('reproduces its published projection without equating existing API with source coverage', () => {
    const projection = buildCatalog(registry, native);
    expect(projection).toEqual(
      JSON.parse(readFileSync(join(repoRoot, 'catalog/catalog.generated.json'), 'utf8')),
    );
    const progress = projection.families.find((family) => family.slug === 'progress');
    expect(progress?.capabilities.web?.tag).toBe('lab-progress');
    expect(
      progress?.sources.find((source) => source.name === 'Circular progress')?.web?.props,
    ).toEqual({ variant: 'circular', value: 25 });
    expect(
      progress?.sources.find((source) => source.name === 'Linear progress')?.web,
    ).toBeDefined();
    const calendar = projection.families.find((family) => family.slug === 'calendar');
    expect(calendar?.capabilities.web?.tag).toBe('lab-calendar');
    expect(calendar?.capabilities.native?.symbol).toBe('LabCalendar');
    expect(calendar?.documentation).not.toBeNull();
  });

  it('rejects a missing or duplicate semantic family and a duplicate source', () => {
    expect(() =>
      buildCatalog(
        { ...registry, families: registry.families.filter((family) => family.slug !== 'calendar') },
        native,
      ),
    ).toThrow('Documentation is outside the catalog: calendar');
    expect(() =>
      buildCatalog(
        { ...registry, families: [...registry.families, ...registry.families.slice(0, 1)] },
        native,
      ),
    ).toThrow('Duplicate catalog family');
    expect(() =>
      buildCatalog(
        { ...registry, sources: [...registry.sources, ...registry.sources.slice(0, 1)] },
        native,
      ),
    ).toThrow('Duplicate source reference');
  });

  it('checks selector properties against the existing AST analyzer', () => {
    const sources = registry.sources.map((source) =>
      source.name === 'Linear progress'
        ? {
            ...source,
            uses: [
              {
                family: 'progress',
                role: 'variant' as const,
                web: { props: { imaginary: true }, scope: 'Invalid binding' },
              },
            ],
          }
        : source,
    );
    expect(() => buildCatalog({ ...registry, sources }, native)).toThrow(
      'Unknown selector prop progress.imaginary',
    );
  });

  it('checks actual React exports and independently observed Compose symbols', () => {
    const families = registry.families.map((family) =>
      family.slug === 'button'
        ? {
            ...family,
            web: { subpath: 'button', reactExport: 'ImaginaryButton' },
          }
        : family,
    );
    expect(() => buildCatalog({ ...registry, families }, native)).toThrow(
      'Unknown React export: ImaginaryButton',
    );
    expect(() =>
      buildCatalog(registry, {
        ...native,
        symbols: native.symbols.filter((symbol) => symbol.name !== 'LabButton'),
      }),
    ).toThrow('Unknown Compose symbol: LabButton');
  });

  it('resolves external Compose API from the same release descriptor as Gradle', () => {
    expect(native.symbols.some((symbol) => symbol.name === 'pics.lab.icons.Icon')).toBe(false);
    for (const version of ['0.4.0', '0.5.0']) {
      const descriptor = {
        version,
        githubRepository: 'Labpics-Team/lab-icons',
        mavenRepositoryCommit: (version === '0.4.0' ? 'a' : 'b').repeat(40),
      };
      const paths: string[] = [];
      const projection = buildCatalog(registry, native, profiles, (path) => {
        paths.push(path);
        return descriptor;
      });
      const icon = projection.families.find((family) => family.slug === 'icon');
      expect(icon?.capabilities.native).toEqual({
        symbol: 'pics.lab.icons.Icon',
        dependency: { module: 'pics.lab:icons-compose', ...descriptor },
      });
      expect(paths).toEqual(['native/compose/icons-release.json']);
    }
  });

  it('rejects incomplete or unpinned external Compose release metadata', () => {
    const descriptor = {
      version: '0.4.0',
      githubRepository: 'Labpics-Team/lab-icons',
      mavenRepositoryCommit: 'a'.repeat(40),
    };
    for (const invalid of [
      null,
      {},
      { ...descriptor, version: '' },
      { ...descriptor, version: '../release' },
      { ...descriptor, githubRepository: 'https://github.com/Labpics-Team/lab-icons' },
      { ...descriptor, mavenRepositoryCommit: 'main' },
    ]) {
      expect(() => buildCatalog(registry, native, profiles, () => invalid)).toThrow(
        'Invalid Compose dependency release: native/compose/icons-release.json',
      );
    }
  });

  it('rejects docs orphaned from the catalog and a broken guide', () => {
    expect(() =>
      buildCatalog(
        { ...registry, families: registry.families.filter((family) => family.slug !== 'proof') },
        native,
      ),
    ).toThrow('Documentation is outside the catalog: proof');
    const families = registry.families.map((family) =>
      family.slug === 'materials'
        ? { ...family, guide: { href: 'missing.html', label: 'Broken' } }
        : family,
    );
    expect(() => buildCatalog({ ...registry, families }, native)).toThrow(
      'Unknown guide: missing.html',
    );
  });

  it('rejects private identifiers, signed thumbnails and private Figma links', () => {
    for (const metadata of [
      { fileKey: 'private' },
      { page: '1234:5678' },
      { image: 'https://image.example/?X-Amz-Signature=secret' },
      { url: 'https://www.figma.com/design/private' },
    ]) {
      expect(() => validatePublicMetadata(metadata)).toThrow('Private Figma provenance');
    }
    expect(() => validatePublicMetadata(registry)).not.toThrow();
  });

  it('resolves every profile reference and rejects a wrong family or duplicated identity', () => {
    expect(() => validateProfileSources(registry, profiles)).not.toThrow();
    const wrong = structuredClone(profiles);
    wrong.button.sourceRef.key = 'component-set/Switch/Switch';
    expect(() => validateProfileSources(registry, wrong)).toThrow(
      'Profile source belongs to another family: button',
    );
    wrong.button.sourceRef.key = 'component-set/Button/Missing';
    expect(() => validateProfileSources(registry, wrong)).toThrow('Unknown profile source: button');
    const duplicate = structuredClone(profiles);
    duplicate.button.sourceRef.page = 'Button';
    expect(() => validateProfileSources(registry, duplicate)).toThrow(
      'Duplicated profile source metadata: button',
    );
  });

  it('resolves Switch selectors and layer paths against the inspected author subtree', () => {
    type Node = { name: string; type: string; children?: Node[] };
    const snapshot = JSON.parse(
      readFileSync(new URL('./fixtures/switch-source.json', import.meta.url), 'utf8'),
    ) as { sourceKey: string; variants: Node[] };
    for (const state of ['on', 'off']) {
      const ref = profiles.switch.cutout[state].sourceRef as ProfileSourceRef;
      expect(ref).toBeDefined();
      expect(ref.key).toBe(snapshot.sourceKey);
      const variants = snapshot.variants.filter((variant) => {
        const properties = Object.fromEntries(
          variant.name.split(', ').map((part) => part.split('=')),
        );
        return Object.entries(ref.variant ?? {}).every(([key, value]) => properties[key] === value);
      });
      expect(variants).toHaveLength(1);
      let node = variants[0];
      for (const name of ref.path ?? []) {
        const children = node?.children?.filter((child) => child.name === name) ?? [];
        expect(children).toHaveLength(1);
        node = children[0];
      }
      expect(node?.type).toBe('VECTOR');
    }
  });
});

describe('complete source inventory from independently supplied metadata', () => {
  const inventory: CatalogRegistry = {
    ...registry,
    sources: [
      {
        page: 'Switch',
        name: 'Switch',
        type: 'component-set',
        uses: [{ family: 'switch', role: 'root' }],
      },
      {
        page: 'Snackbar',
        name: 'Snackbar',
        type: 'component',
        uses: [{ family: 'snackbar', role: 'root' }],
      },
    ],
  };
  const setsPath = join(temporary, 'sets.json');
  const componentsPath = join(temporary, 'components.json');
  const components = [
    { name: 'Snackbar', containing_frame: { pageName: 'Snackbar' } },
    { name: 'arrow-right', containing_frame: { pageName: '🟣 Icons' } },
    { name: 'RU', containing_frame: { pageName: '🟤 Flags' } },
    ...['neutral, Toggle=false', 'accent, Toggle=true'].map((type) => ({
      name: `Type=${type}, Size=medium, State=default, Icon=true`,
      containing_frame: { pageName: 'Switch', containingComponentSet: { name: 'Switch' } },
    })),
  ];
  writeFileSync(
    setsPath,
    JSON.stringify({
      meta: { component_sets: [{ name: 'Switch', containing_frame: { pageName: 'Switch' } }] },
    }),
  );
  writeFileSync(componentsPath, JSON.stringify({ meta: { components } }));

  it('classifies standalone components, variant members and explicit asset collections', () => {
    expect(() =>
      validateSourceCache(inventory, setsPath, componentsPath, {
        switch: profiles.switch,
        snackbar: profiles.snackbar,
      }),
    ).not.toThrow();
  });

  it('rejects deleting a standalone Snackbar from the registry', () => {
    expect(() =>
      validateSourceCache(
        {
          ...inventory,
          sources: inventory.sources.filter((source) => source.page !== 'Snackbar'),
        },
        setsPath,
        componentsPath,
      ),
    ).toThrow('Unclassified standalone source: Snackbar / Snackbar');
  });

  it('rejects a missing cached singleton and an unclassified asset page', () => {
    const missingPath = join(temporary, 'missing-components.json');
    writeFileSync(missingPath, JSON.stringify({ meta: { components: components.slice(1) } }));
    expect(() => validateSourceCache(inventory, setsPath, missingPath)).toThrow(
      'Singleton source missing: Snackbar / Snackbar',
    );
    expect(() =>
      validateSourceCache({ ...inventory, sourceExclusions: [] }, setsPath, componentsPath),
    ).toThrow('Unclassified standalone source: 🟣 Icons / arrow-right');
  });

  it('rejects an invented or ambiguous author variant selector', () => {
    const wrong = structuredClone(profiles.switch);
    wrong.cutout.on.sourceRef.variant.State = 'imaginary';
    expect(() =>
      validateSourceCache(inventory, setsPath, componentsPath, { switch: wrong }),
    ).toThrow('Profile variant does not select one source: component-set/Switch/Switch');
    wrong.cutout.on.sourceRef.variant = { Size: 'medium' };
    expect(() =>
      validateSourceCache(inventory, setsPath, componentsPath, { switch: wrong }),
    ).toThrow('Profile variant does not select one source: component-set/Switch/Switch');
  });
});

it('native provenance follows consumed Kotlin inputs rather than unrelated commits', () => {
  const root = join(temporary, 'native-repo');
  const directory = join(root, 'native/compose/src/commonMain/kotlin/pics/lab/ui');
  mkdirSync(directory, { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  const commit = () => {
    git('add', '.');
    git(
      '-c',
      'user.name=Catalog test',
      '-c',
      'user.email=catalog@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    );
  };
  git('init', '--quiet');
  git('config', 'core.autocrlf', 'false');
  writeFileSync(join(directory, 'LabExample.kt'), 'public fun LabExample() = Unit\n');
  commit();
  const before = discoverNative(root);
  writeFileSync(join(directory, 'README.md'), 'This file is not a Kotlin source input.\n');
  commit();
  expect(discoverNative(root)).toEqual(before);
  writeFileSync(join(directory, 'LabExample.kt'), 'public fun LabExample() = 1\n');
  const changed = discoverNative(root);
  expect(changed.sourceDigest).not.toBe(before.sourceDigest);
  expect(changed.symbols).toEqual(before.symbols);
  commit();
  expect(discoverNative(root)).toEqual(changed);
  writeFileSync(join(directory, 'LabAdded.kt'), 'public object LabAdded\n');
  const added = discoverNative(root);
  expect(added.symbols.map((symbol) => symbol.name)).toEqual(['LabAdded', 'LabExample']);
  commit();
  expect(discoverNative(root)).toEqual(added);
  rmSync(join(directory, 'LabAdded.kt'));
  commit();
  const removed = discoverNative(root);
  expect(removed.sourceDigest).toBe(changed.sourceDigest);
});

it('checks a source snapshot without Git and detects changed input even with the same API', () => {
  const root = join(temporary, 'source-snapshot');
  const directory = 'native/compose/src/commonMain/kotlin/pics/lab/ui';
  cpSync(join(repoRoot, directory), join(root, directory), { recursive: true });
  expect(existsSync(join(root, '.git'))).toBe(false);
  expect(() => catalogMain(['--check', '--native-root', root])).not.toThrow();
  const source = join(root, directory, 'LabSwitch.kt');
  writeFileSync(source, `${readFileSync(source, 'utf8')}\n// Changed source snapshot\n`);
  expect(() => catalogMain(['--check', '--native-root', root])).toThrow(
    'Native API observation is stale; run pnpm catalog:generate',
  );
});
