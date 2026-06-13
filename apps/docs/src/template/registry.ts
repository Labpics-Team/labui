import { buttonDoc } from '../components/button.doc.js';
import { proofDoc } from '../components/proof.doc.js';
/*
 * Component registry — the ONE place that grows when LabUI gains a component.
 *
 * This is the OCP extension point (craft-arch). To document a new component:
 *   1. author its `ComponentDoc` (e.g. `button.doc.ts`);
 *   2. import it here and add it to `REGISTRY`.
 * Nothing in the template renderer changes. The sidebar, routing, and page
 * assembly all read from this list, so a new entry lights up the whole site.
 *
 * The registry now holds two real entries — the `lab-proof` PROOF element and
 * the first PRODUCTION component, `lab-button`. Future components append here as
 * `{ kind: 'doc', doc }`; until a component is real it stays an honest `planned`
 * placeholder — a dimmed, non-clickable nav marker, never a fake component.
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

export const REGISTRY: Registry = [
  { kind: 'doc', doc: buttonDoc },
  { kind: 'doc', doc: proofDoc },
  // The seam is open: future components append here as `{ kind: 'doc', doc }`.
  // Until a component is real it stays an honest `planned` placeholder — a
  // dimmed, non-clickable nav marker, never a fake component. Input is next.
  { kind: 'planned', slug: 'input', title: 'Input (planned)' },
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
