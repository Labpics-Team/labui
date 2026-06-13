/*
 * Component registry — AUTO-DISCOVERED from the component-doc files.
 *
 * Every `src/components/*.doc.ts` is found at build time via Vite's
 * `import.meta.glob` and folded into `REGISTRY`. Documenting a NEW component is
 * therefore purely additive: author its `<name>.doc.ts` (exporting one
 * `ComponentDoc`) and it lights up the whole site — sidebar, routing, page
 * assembly — with NO edit to this file or any other shared file. That is what
 * unblocks parallel component batches: they only ever ADD files.
 *
 * Two things stay explicit, on purpose:
 *   - ORDER. Discovery has no inherent sequence, so entries sort by each doc's
 *     optional `order` (lower first), then alphabetically by slug. A component
 *     claims its narrative position in its OWN doc file, never here.
 *   - PLANNED placeholders. A "coming soon" nav marker is an honest editorial
 *     statement, not a discovered artifact — there is no file to discover yet.
 *     So the planned list below is hand-kept; it never pretends to be real.
 *
 * The template renderer stays CLOSED for modification (craft-arch / OCP): it
 * consumes whatever `REGISTRY` holds and emits the page.
 */
import type { ComponentDoc } from './component-doc.js';

export type Registry = ReadonlyArray<RegistryEntry>;

/**
 * A registry entry is either a fully documented component (`doc`) or a planned
 * placeholder (`planned`) that appears in the nav as "coming soon" without
 * pretending to be real. Making the two states explicit keeps the nav honest.
 */
export type RegistryEntry =
  | { readonly kind: 'doc'; readonly doc: ComponentDoc }
  | { readonly kind: 'planned'; readonly slug: string; readonly title: string };

/**
 * Auto-discovered documentation modules. Each `*.doc.ts` exports exactly one
 * `ComponentDoc` (the `<name>Doc` const); eager loading runs the module so the
 * documented custom element self-registers, exactly as the old manual imports
 * did. Typed against the module shape so a malformed doc file fails the build.
 */
const docModules = import.meta.glob<Record<string, ComponentDoc>>('../components/*.doc.ts', {
  eager: true,
});

/** Pull the single `ComponentDoc` export out of a discovered doc module. */
function docOf(module: Record<string, ComponentDoc>): ComponentDoc | undefined {
  for (const value of Object.values(module)) {
    // A ComponentDoc is the one export that carries a `slug`. This tolerates
    // future incidental exports without guessing at the const's name.
    if (value && typeof value === 'object' && typeof value.slug === 'string') return value;
  }
  return undefined;
}

/** Discovered docs, ordered by `order` (lower first) then alphabetically by slug. */
const discoveredDocs: ComponentDoc[] = Object.values(docModules)
  .map(docOf)
  .filter((doc): doc is ComponentDoc => doc !== undefined)
  .sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.slug.localeCompare(b.slug);
  });

/**
 * Honest "coming soon" markers — hand-kept, because a planned component has no
 * file to discover. A planned entry becomes a real `doc` the moment its
 * `<name>.doc.ts` lands and is discovered; remove it from this list then.
 */
const PLANNED: ReadonlyArray<Extract<RegistryEntry, { kind: 'planned' }>> = [
  { kind: 'planned', slug: 'input', title: 'Input (planned)' },
];

export const REGISTRY: Registry = [
  ...discoveredDocs.map((doc): RegistryEntry => ({ kind: 'doc', doc })),
  ...PLANNED,
];

/** Look up a documented component by slug. Planned entries are not resolvable. */
export function findDoc(registry: Registry, slug: string): ComponentDoc | undefined {
  for (const entry of registry) {
    if (entry.kind === 'doc' && entry.doc.slug === slug) return entry.doc;
  }
  return undefined;
}

/** The slug rendered when no slug is supplied (first documented component). */
export function defaultSlug(registry: Registry): string | undefined {
  for (const entry of registry) {
    if (entry.kind === 'doc') return entry.doc.slug;
  }
  return undefined;
}
