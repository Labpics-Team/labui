import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CatalogRegistry, NativeApi } from '../../../catalog/types.js';
import { buildCatalog, validatePublicMetadata } from '../src/catalog.js';
import { repoRoot } from '../src/paths.js';

const registry = JSON.parse(
  readFileSync(join(repoRoot, 'catalog/registry.json'), 'utf8'),
) as CatalogRegistry;
const native = JSON.parse(
  readFileSync(join(repoRoot, 'catalog/native-api.generated.json'), 'utf8'),
) as NativeApi;

describe('semantic catalog joined to real API and documentation', () => {
  it('reproduces its published projection without equating existing API with source coverage', () => {
    const projection = buildCatalog(registry, native);
    expect(projection).toEqual(
      JSON.parse(readFileSync(join(repoRoot, 'catalog/catalog.generated.json'), 'utf8')),
    );
    const progress = projection.families.find((family) => family.slug === 'progress');
    expect(progress?.capabilities.web?.tag).toBe('lab-progress');
    expect(
      progress?.sources.find((source) => source.name === 'Circular progress')?.web,
    ).toBeUndefined();
    expect(
      progress?.sources.find((source) => source.name === 'Linear progress')?.web,
    ).toBeDefined();
    const calendar = projection.families.find((family) => family.slug === 'calendar');
    expect(calendar?.capabilities).toEqual({ web: null, native: null });
    expect(calendar?.documentation).toBeNull();
  });

  it('rejects a missing or duplicate semantic family and a duplicate source', () => {
    expect(() =>
      buildCatalog(
        { ...registry, families: registry.families.filter((family) => family.slug !== 'calendar') },
        native,
      ),
    ).toThrow('Unknown family: calendar');
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
});
