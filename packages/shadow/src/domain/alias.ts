import type { ElevationLevelName } from './elevation.js';

/**
 * Semantic elevation ROLE aliases over the size primitives. The size (XS..XL) is
 * the primitive; the role is a named alias onto a size — the HIG pattern "size
 * is the primitive, role is the alias" (same shape as the token system). A
 * component may consume either a size (`--lab-shadow-m`) or a role
 * (`--lab-elevation-raised`); the role is just a pointer to a size.
 *
 * Mapping (owner verdict, justified in README):
 *   resting → XS  — a resting surface barely lifts off the page.
 *   raised  → S   — a raised card sits just above its neighbours.
 *   overlay → L   — a popover/overlay floats clearly above content.
 *   modal   → XL  — a modal dominates, floating above everything.
 * (M is an intentional gap — a size with no role, available directly.)
 */
export const ELEVATION_ROLES = ['resting', 'raised', 'overlay', 'modal'] as const;

export type ElevationRoleName = (typeof ELEVATION_ROLES)[number];

export const ROLE_TO_SIZE: Readonly<Record<ElevationRoleName, ElevationLevelName>> = {
  resting: 'xs',
  raised: 's',
  overlay: 'l',
  modal: 'xl',
};
