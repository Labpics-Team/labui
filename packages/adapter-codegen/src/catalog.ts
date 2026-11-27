import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import type {
  CatalogProjection,
  CatalogRegistry,
  NativeApi,
  ProfileSourceRef,
} from '../../../catalog/types.js';
import { analyzeCore } from './analyze.js';
import { coreComponentsDir, repoRoot } from './paths.js';

const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export const sourceKey = (source: { page: string; name: string; type: string }) =>
  `${source.type}/${source.page}/${source.name}`;
const componentProfiles = () =>
  json<Record<string, unknown>>(join(repoRoot, 'packages/tokens/src/components.json'));
const nativeSourceDirectory = 'native/compose/src/commonMain/kotlin/pics/lab/ui';

/** Profile measurements refer to registry sources; they do not copy source identity. */
export function validateProfileSources(
  registry: CatalogRegistry,
  profiles: Record<string, unknown>,
): ProfileSourceRef[] {
  validatePublicMetadata(profiles);
  const sources = new Map(registry.sources.map((source) => [sourceKey(source), source]));
  const refs: ProfileSourceRef[] = [];
  for (const [profile, definition] of Object.entries(profiles)) {
    const families = registry.families
      .filter((family) => family.profile === profile)
      .map((family) => family.slug);
    ensure(families.length > 0, `Profile is outside the catalog: ${profile}`);
    ensure(
      definition && typeof definition === 'object' && 'sourceRef' in definition,
      `Profile needs a registry sourceRef: ${profile}`,
    );
    ensure(!('source' in definition), `Duplicated profile source metadata: ${profile}`);
    const visit = (value: unknown, location: string): void => {
      if (!value || typeof value !== 'object') return;
      if ('sourceRef' in value) {
        const ref = value.sourceRef as ProfileSourceRef;
        ensure(ref && typeof ref === 'object', `Invalid profile sourceRef: ${location}`);
        const source = sources.get(ref.key);
        ensure(source, `Unknown profile source: ${location}`);
        ensure(
          source.uses.some((use) => families.includes(use.family)),
          `Profile source belongs to another family: ${location}`,
        );
        ensure(
          !['publicUrl', 'page', 'name', 'role'].some((key) => Object.hasOwn(ref, key)),
          `Duplicated profile source metadata: ${location}`,
        );
        if (ref.variant)
          ensure(
            source.type === 'component-set' &&
              Object.keys(ref.variant).length > 0 &&
              Object.values(ref.variant).every((item) => typeof item === 'string' && item.trim()),
            `Invalid profile variant selector: ${location}`,
          );
        if (ref.path)
          ensure(
            Array.isArray(ref.path) &&
              ref.path.length > 0 &&
              ref.path.every((part) => typeof part === 'string' && part.trim()) &&
              (source.type === 'component' || ref.variant),
            `Invalid profile layer path: ${location}`,
          );
        refs.push(ref);
      }
      for (const [key, child] of Object.entries(value))
        if (key !== 'sourceRef') visit(child, `${location}.${key}`);
    };
    visit(definition, profile);
  }
  return refs;
}

/** Refuse private provenance anywhere in the published catalog or profile metadata. */
export function validatePublicMetadata(value: unknown): void {
  const text = serialize(value);
  ensure(
    !/"(?:fileKey|file_key|node_id|nodeId|componentSet|sourceNode|thumbnail_url)"|X-Amz-|figma\.com\/(?:design|file)\/|"\d+:\d+"/i.test(
      text,
    ),
    'Private Figma provenance cannot be published',
  );
}

/** Metadata exports are read through TS AST, independently from authored docs. */
function moduleExports(path: string): Set<string> {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const names = new Set<string>();
  for (const node of file.statements) {
    if (
      !ts.isExportDeclaration(node) ||
      node.isTypeOnly ||
      !node.exportClause ||
      !ts.isNamedExports(node.exportClause)
    )
      continue;
    for (const item of node.exportClause.elements) if (!item.isTypeOnly) names.add(item.name.text);
  }
  return names;
}

function documentation(): Map<string, string> {
  const directory = join(repoRoot, 'apps/docs/src/components');
  const docs = new Map<string, string>();
  for (const name of readdirSync(directory)
    .filter((name) => name.endsWith('.doc.ts'))
    .sort()) {
    const file = ts.createSourceFile(
      name,
      readFileSync(join(directory, name), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const slugs: string[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(file) === 'slug' &&
        ts.isStringLiteral(node.initializer)
      )
        slugs.push(node.initializer.text);
      ts.forEachChild(node, visit);
    };
    visit(file);
    ensure(slugs.length === 1, `${name}: expected one documentation slug`);
    const slug = slugs[0];
    ensure(slug, `${name}: missing documentation slug`);
    ensure(!docs.has(slug), `Duplicate documentation slug: ${slug}`);
    docs.set(slug, name);
  }
  return docs;
}

/** The native tree may be supplied before the web/native branches are integrated. */
export function discoverNative(nativeRoot: string): Omit<NativeApi, 'revision'> {
  const directory = join(nativeRoot, nativeSourceDirectory);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.kt'))
    .sort();
  ensure(files.length > 0, 'No native Kotlin source inputs');
  const digest = createHash('sha256');
  const symbols: { name: string; file: string }[] = [];
  for (const file of files) {
    const source = readFileSync(join(directory, file), 'utf8').replaceAll('\r\n', '\n');
    digest.update(file).update('\0').update(source).update('\0');
    for (const match of source.matchAll(/^public (?:fun|object) (Lab\w+)\b/gm)) {
      symbols.push({
        name: match[1] ?? '',
        file: `${nativeSourceDirectory}/${file}`,
      });
    }
  }
  return {
    sourceDigest: `sha256:${digest.digest('hex')}`,
    symbols,
  };
}

/** Only a changed observation needs a new Git source link; builds use the saved link. */
function nativeSourceRevision(nativeRoot: string): string {
  const sourcePaths = readdirSync(join(nativeRoot, nativeSourceDirectory))
    .filter((name) => name.endsWith('.kt'))
    .map((file) => `${nativeSourceDirectory}/${file}`);
  // The glob includes deleted Kotlin inputs, but excludes unrelated documentation.
  const sourceGlob = `:(glob)${nativeSourceDirectory}/*.kt`;
  const options = { cwd: nativeRoot, stdio: 'pipe' as const };
  execFileSync('git', ['ls-files', '--error-unmatch', '--', ...sourcePaths], options);
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', sourceGlob], options);
  return execFileSync('git', ['log', '-1', '--format=%H', '--', sourceGlob], {
    ...options,
    encoding: 'utf8',
  }).trim();
}

export function buildCatalog(
  registry: CatalogRegistry,
  native: NativeApi,
  profile = componentProfiles(),
): CatalogProjection {
  ensure(registry.schemaVersion === 1, 'Unknown catalog schema');
  validatePublicMetadata(registry);
  ensure(
    registry.source.publicUrl.startsWith('https://www.figma.com/community/'),
    'Public Community source required',
  );
  const groups = new Set(registry.groups.map((group) => group.id));
  ensure(groups.size === registry.groups.length, 'Duplicate catalog group');
  const families = new Map(registry.families.map((family) => [family.slug, family]));
  ensure(families.size === registry.families.length, 'Duplicate catalog family');
  const keys = new Set(registry.sources.map(sourceKey));
  ensure(keys.size === registry.sources.length, 'Duplicate source reference');
  const manifest = analyzeCore(coreComponentsDir);
  const web = new Map(manifest.components.map((component) => [component.subpath, component]));
  const exports = moduleExports(join(repoRoot, 'packages/react/src/index.ts'));
  const docs = documentation();
  for (const slug of docs.keys())
    ensure(families.has(slug), `Documentation is outside the catalog: ${slug}`);
  for (const component of manifest.components) {
    ensure(
      registry.families.some((family) => family.web?.subpath === component.subpath),
      `Core API is outside the catalog: ${component.subpath}`,
    );
  }
  for (const source of registry.sources) {
    ensure(source.uses.length > 0, `Source has no family: ${sourceKey(source)}`);
    ensure(
      new Set(source.uses.map((use) => use.family)).size === source.uses.length,
      `Duplicate source use: ${sourceKey(source)}`,
    );
    for (const use of source.uses) {
      const family = families.get(use.family);
      ensure(family, `Unknown family: ${use.family}`);
      ensure(
        ['root', 'variant', 'part', 'material'].includes(use.role),
        `Unknown source role: ${use.role}`,
      );
      if (use.web) {
        const component = web.get(family?.web?.subpath ?? '');
        ensure(component || family?.webModule, `Binding without Web API: ${use.family}`);
        ensure(use.web.scope.trim(), `Binding needs a scope: ${sourceKey(source)}`);
        for (const prop of Object.keys(use.web.props ?? {})) {
          ensure(
            component?.props.some((candidate) => candidate.name === prop),
            `Unknown selector prop ${use.family}.${prop}`,
          );
        }
      }
      if (use.native)
        ensure(
          family?.native && use.native.scope.trim(),
          `Binding without Compose API: ${use.family}`,
        );
    }
  }
  validateProfileSources(registry, profile);
  return {
    source: registry.source,
    groups: registry.groups,
    families: registry.families.map((family) => {
      ensure(groups.has(family.group), `Unknown group: ${family.group}`);
      const api = family.web ? web.get(family.web.subpath) : undefined;
      if (family.web) {
        ensure(api, `Unknown Web API: ${family.web.subpath}`);
        ensure(
          exports.has(family.web.reactExport),
          `Unknown React export: ${family.web.reactExport}`,
        );
      }
      if (family.webModule)
        ensure(
          moduleExports(join(repoRoot, family.webModule.path)).has(family.webModule.export),
          `Unknown module export: ${family.webModule.export}`,
        );
      const nativeSymbol = family.native
        ? native.symbols.find((symbol) => symbol.name === family.native?.symbol)
        : undefined;
      if (family.native) ensure(nativeSymbol, `Unknown Compose symbol: ${family.native.symbol}`);
      if (family.profile)
        ensure(Object.hasOwn(profile, family.profile), `Unknown profile: ${family.profile}`);
      if (family.guide)
        ensure(
          existsSync(join(repoRoot, 'apps/docs/src', family.guide.href)),
          `Unknown guide: ${family.guide.href}`,
        );
      return {
        ...family,
        documentation: docs.get(family.slug) ?? null,
        capabilities: {
          web:
            api && family.web
              ? { tag: api.tag, reactExport: family.web.reactExport }
              : family.webModule
                ? { tag: null, reactExport: null, module: family.webModule.export }
                : null,
          native: nativeSymbol
            ? { symbol: nativeSymbol.name, file: nativeSymbol.file, revision: native.revision }
            : null,
        },
        sources: registry.sources.flatMap(({ uses, ...source }) =>
          uses.filter((use) => use.family === family.slug).map((use) => ({ ...source, ...use })),
        ),
      };
    }),
  };
}

/** Checks all component sets and the semantic singleton roots against a local REST cache.
 * Private identifiers never enter the public projection or error messages.
 */
export function validateSourceCache(
  registry: CatalogRegistry,
  setsPath: string,
  componentsPath: string,
  profiles?: Record<string, unknown>,
): void {
  type Metadata = {
    name: string;
    containing_frame: { pageName: string; containingComponentSet?: { name: string } };
  };
  const sets = json<{ meta: { component_sets: Metadata[] } }>(setsPath).meta.component_sets;
  const components = json<{ meta: { components: Metadata[] } }>(componentsPath).meta.components;
  const key = (item: Metadata, type: string) =>
    sourceKey({
      page: item.containing_frame.pageName.replace(/^⚪️\s*/, ''),
      name: item.name,
      type,
    });
  const expected = new Set(
    registry.sources.filter((source) => source.type === 'component-set').map(sourceKey),
  );
  const observed = new Set(sets.map((item) => key(item, 'component-set')));
  ensure(
    expected.size === sets.length &&
      expected.size === observed.size &&
      [...expected].every((ref) => observed.has(ref)),
    'Component-set inventory differs from the source cache',
  );
  const excluded = new Set(registry.sourceExclusions.map((entry) => entry.page));
  ensure(excluded.size === registry.sourceExclusions.length, 'Duplicate source exclusion');
  ensure(
    registry.sourceExclusions.every((entry) => entry.page.trim() && entry.reason.trim()),
    'Source exclusion needs an exact page and a reason',
  );
  ensure(
    registry.sources.every((source) => !excluded.has(source.page)),
    'Source is both cataloged and excluded',
  );
  const standalone = components.filter((item) => !item.containing_frame.containingComponentSet);
  const singletons = new Set(standalone.map((item) => key(item, 'component')));
  const classified = new Set(registry.sources.map(sourceKey));
  for (const item of standalone) {
    ensure(
      classified.has(key(item, 'component')) || excluded.has(item.containing_frame.pageName),
      `Unclassified standalone source: ${item.containing_frame.pageName} / ${item.name}`,
    );
  }
  for (const source of registry.sources.filter((source) => source.type === 'component')) {
    ensure(
      singletons.has(sourceKey(source)),
      `Singleton source missing: ${source.page} / ${source.name}`,
    );
  }
  if (profiles)
    for (const ref of validateProfileSources(registry, profiles)) {
      if (!ref.variant) continue;
      const matches = components.filter((item) => {
        const parent = item.containing_frame.containingComponentSet;
        if (!parent || key({ ...item, name: parent.name }, 'component-set') !== ref.key)
          return false;
        const properties = Object.fromEntries(
          item.name.split(/,\s*/).map((part) => {
            const separator = part.indexOf('=');
            return [part.slice(0, separator), part.slice(separator + 1)];
          }),
        );
        return Object.entries(ref.variant ?? {}).every(
          ([name, value]) => properties[name] === value,
        );
      });
      ensure(matches.length === 1, `Profile variant does not select one source: ${ref.key}`);
    }
}

export function catalogMain(args = process.argv.slice(2)): void {
  const check = args.includes('--check');
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const registry = json<CatalogRegistry>(join(repoRoot, 'catalog/registry.json'));
  const profiles = componentProfiles();
  const nativePath = join(repoRoot, 'catalog/native-api.generated.json');
  const nativeRoot =
    option('--native-root') ??
    (existsSync(join(repoRoot, 'native/compose')) ? repoRoot : undefined);
  let native = json<NativeApi>(nativePath);
  if (nativeRoot) {
    const root = resolve(nativeRoot);
    const observation = discoverNative(root);
    if (
      native.sourceDigest !== observation.sourceDigest ||
      serialize(native.symbols) !== serialize(observation.symbols)
    ) {
      ensure(!check, 'Native API observation is stale; run pnpm catalog:generate');
      native = { revision: nativeSourceRevision(root), ...observation };
    }
  }
  const sets = option('--source-sets');
  const components = option('--source-components');
  if (sets || components) {
    ensure(sets && components, 'Supply both --source-sets and --source-components');
    validateSourceCache(registry, sets, components, profiles);
  }
  const result = buildCatalog(registry, native, profiles);
  const output = join(repoRoot, 'catalog/catalog.generated.json');
  const serialized = serialize(result);
  if (check) {
    ensure(
      readFileSync(output, 'utf8') === serialized,
      'Catalog projection is stale; run pnpm catalog:generate',
    );
  } else {
    writeFileSync(output, serialized);
    if (nativeRoot) writeFileSync(nativePath, serialize(native));
  }
  process.stdout.write(
    `Catalog: ${result.families.length} families, ${registry.sources.length} semantic source references; API and bindings validated.\n`,
  );
}

if (process.argv[1]?.endsWith('catalog.ts')) catalogMain();
