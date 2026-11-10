export type LabuiBackdropObservation =
  | Readonly<{ kind: 'observed'; surface: readonly [number, number, number] }>
  | Readonly<{ kind: 'unknown'; reason: string }>;

export interface LabuiColorsState {
  readonly state:
    | 'waiting'
    | 'ready'
    | 'stale'
    | 'failed'
    | 'unsatisfied'
    | 'incomplete'
    | 'cancelled'
    | 'disposed';
  readonly reason: string | null;
  readonly revision: bigint | null;
  readonly snapshotVersion?: number;
  readonly theme?: 'light' | 'dark';
  readonly contrast?: 'normal' | 'more';
  readonly outputCount?: number;
  readonly error?: unknown;
  readonly cleanup?: unknown;
}

export interface LabuiColorsAttachment {
  readonly ready: Promise<LabuiColorsState>;
  readonly state: LabuiColorsState;
  refresh(): Promise<LabuiColorsState>;
  cancel(): LabuiColorsState;
  dispose(): LabuiColorsState;
}

/** Читает явную равномерную подложку; область модели не охватывает всё поле. */
export function readOpaqueBackdrop(element: HTMLElement): LabuiBackdropObservation;

export function attachLabuiColors(
  options: {
    scope: HTMLElement;
    config?: unknown;
    canvas?: 'authored';
    wasmUrl?: string | URL;
    onState?: (state: LabuiColorsState) => void;
  } & (
    | { backdrop: HTMLElement; observe?: () => LabuiBackdropObservation }
    | { backdrop?: HTMLElement; observe: () => LabuiBackdropObservation }
  ),
): LabuiColorsAttachment;
