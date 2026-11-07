/**
 * Domain model for Lab UI motion roles.
 *
 * LabUI владеет характером и калибровкой движения. LabMotion предоставляет
 * физическую модель и исполнение; готовые пресеты остаются допустимым выбором.
 */

export type ProvenanceClass = 'b' | 'e';

export interface Provenance {
  readonly class: ProvenanceClass;
  readonly source: string;
}

/** Spring category: spatial motion may overshoot; effects motion may not. */
export type SpringCategory = 'spatial' | 'effects';

export type MotionSpringPrimitive = 'smooth' | 'expressive';
interface SpringRole {
  readonly name: string;
  readonly category: SpringCategory;
  readonly fallbackEasing: string;
  readonly description?: string;
}

/** Response в миллисекундах, как в runtime LabMotion; bounce безразмерный. */
export type SpringSpec = SpringRole &
  (
    | { readonly primitive: MotionSpringPrimitive }
    | { readonly response: number; readonly bounce: number; readonly provenance: Provenance }
  );

/** A semantic UI role referencing physical primitive names. */
export interface SemanticSpec {
  readonly name: string;
  readonly duration: string;
  readonly easing: string;
  readonly spring?: string;
  readonly reduced: {
    readonly duration: string;
    readonly easing: 'linear';
  };
  readonly provenance: Provenance;
  readonly description?: string;
}

/** Семантика и калибровка LabUI без собственного solver. */
export interface MotionConfig {
  readonly springs: readonly SpringSpec[];
  readonly semantics: readonly SemanticSpec[];
}
