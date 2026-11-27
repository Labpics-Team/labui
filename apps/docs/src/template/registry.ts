import catalogData from '../../../../catalog/catalog.generated.json';
import type { CatalogEntry, CatalogProjection } from '../../../../catalog/types.js';
import type { ComponentDoc } from './component-doc.js';

/** Semantic catalog joined with authored examples, without a second status list. */
export type RegistryEntry = CatalogEntry;
export type Registry = readonly RegistryEntry[];
export const CATALOG = catalogData as CatalogProjection;
const modules = import.meta.glob<Record<string, unknown>>('../components/*.doc.ts');
export const REGISTRY: Registry = CATALOG.families;

/** Overview and missing routes do not load any component implementation. */
export async function loadDoc(entry: RegistryEntry): Promise<ComponentDoc | undefined> {
  if (!entry.documentation) return undefined;
  const loader = modules[`../components/${entry.documentation}`];
  if (!loader) throw new Error(`Stale catalog documentation: ${entry.slug}`);
  const module = await loader();
  const docs = Object.values(module).filter((value): value is ComponentDoc =>
    Boolean(value && typeof value === 'object' && 'slug' in value),
  );
  if (docs.length !== 1 || docs[0]?.slug !== entry.slug)
    throw new Error(`Documentation does not match catalog: ${entry.slug}`);
  return docs[0];
}
export function findEntry(registry: Registry, slug: string): RegistryEntry | undefined {
  return registry.find((entry) => entry.slug === slug);
}
