import type {
  IconEffectOptions,
  MountedIcon,
  SymbolMotionExecutor,
  SymbolPlayback,
} from '@labpics/icons/motion';
import {
  type IconSymbol,
  type IconVariant,
  type RenderIconOptions,
  renderIcon,
} from '@labpics/icons/render';
import {
  type TypographyScale,
  type TypographySize,
  resolveTypographySize,
} from '../../typography.js';
export { createTypographyScale, typographyStyle, resolveTypographySize } from '../../typography.js';
export type { TypographyScale, TypographySize } from '../../typography.js';
export type { IconSymbol, IconVariant, IconEffectOptions, SymbolPlayback };

export interface IconOptions {
  readonly symbol?: IconSymbol | null;
  readonly variant?: IconVariant;
  readonly size?: TypographySize;
  readonly scale?: TypographyScale;
  readonly weight?: number;
  readonly opsz?: number | 'auto';
  readonly state?: string;
  readonly date?: Date;
  readonly timeZone?: string;
  readonly duration?: number;
  readonly reducedMotion?: boolean;
  /** A named authored gesture. Change effectKey to replay the same gesture. */
  readonly effect?: string;
  readonly effectKey?: number | string;
}
export interface IconHandle {
  playEffect(name: string, options?: IconEffectOptions): Promise<SymbolPlayback | null>;
}
export interface IconController extends IconHandle {
  update(options: IconOptions): void;
  dispose(): void;
}

export function iconRenderOptions(options: IconOptions): RenderIconOptions {
  return {
    variant: options.variant,
    state: options.state,
    size: resolveTypographySize(options.size ?? 24, options.scale).pixels,
    weight: options.weight,
    opsz: options.opsz ?? 'auto',
    date:
      options.date === undefined ? undefined : new Date(Date.prototype.getTime.call(options.date)),
    timeZone: options.timeZone,
  };
}

/** A pure first frame shared by SSR, Lit and React. Only imported packets enter this renderer. */
export function iconMarkup(options: IconOptions): string {
  return options.symbol
    ? renderIcon(options.symbol, iconRenderOptions(options)).replace(
        '<svg ',
        '<svg aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%;overflow:visible" ',
      )
    : '';
}

let motionModule: Promise<SymbolMotionExecutor> | undefined;
function loadMotion(): Promise<SymbolMotionExecutor> {
  motionModule ??= Promise.all([import('@labpics/icons/motion'), import('@labpics/motion')])
    .then(([icons, motion]) => icons.createSymbolMotion(motion))
    .catch((error) => {
      motionModule = undefined;
      throw error;
    });
  return motionModule;
}

function equalPose(a: RenderIconOptions, b: RenderIconOptions): boolean {
  return (
    a.variant === b.variant &&
    a.state === b.state &&
    a.size === b.size &&
    a.weight === b.weight &&
    a.opsz === b.opsz &&
    a.date?.getTime() === b.date?.getTime() &&
    a.timeZone === b.timeZone
  );
}

/** The only writer inside the SVG container after hydration. Static instances create no clock or observer. */
export function createIconController(root: HTMLElement, initial: IconOptions): IconController {
  let current = initial;
  let pose = iconRenderOptions(initial);
  let staticPose = pose;
  let mounted: MountedIcon | undefined;
  let loading: Promise<MountedIcon | undefined> | undefined;
  let disposed = false;
  let generation = 0;
  let reduced: MediaQueryList | undefined;
  let observingReduced = false;
  let pendingState = false;
  const active = new Set<SymbolPlayback>();

  function report(error: unknown): void {
    if (!disposed)
      root.dispatchEvent(
        new CustomEvent('icon-error', { detail: { error }, bubbles: true, composed: true }),
      );
  }
  function timing() {
    return { duration: current.duration ?? 180, reducedMotion: current.reducedMotion };
  }
  function syncReduced(): void {
    const running =
      !disposed && (pendingState || [...active].some((playback) => playback.state === 'running'));
    if (running === observingReduced) return;
    observingReduced = running;
    if (running) {
      reduced ??= root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
      reduced?.addEventListener('change', settleReduced);
    } else reduced?.removeEventListener('change', settleReduced);
  }
  function finishActive(): void {
    for (const playback of active) playback.finish();
    syncReduced();
  }
  function settleReduced(): void {
    if (!reduced?.matches) return;
    if (pendingState) {
      reset();
      writeStatic();
    } else finishActive();
  }
  function track(playback: SymbolPlayback): SymbolPlayback {
    function refresh(): void {
      if (playback.state === 'running' || playback.state === 'paused') active.add(playback);
      else active.delete(playback);
      syncReduced();
    }
    function release(): void {
      active.delete(playback);
      syncReduced();
    }
    refresh();
    void playback.finished.then(release, release);
    return {
      get state() {
        return playback.state;
      },
      duration: playback.duration,
      finished: playback.finished,
      pause() {
        playback.pause();
        refresh();
      },
      play() {
        if (current.reducedMotion || reduced?.matches) playback.finish();
        else playback.play();
        refresh();
      },
      seek(time) {
        playback.seek(time);
        refresh();
      },
      finish() {
        playback.finish();
        refresh();
      },
      stop() {
        playback.stop();
        release();
      },
    };
  }
  function reset(): void {
    generation++;
    reduced?.removeEventListener('change', settleReduced);
    observingReduced = false;
    pendingState = false;
    reduced = undefined;
    active.clear();
    mounted?.dispose();
    mounted = undefined;
    loading = undefined;
  }
  function writeStatic(): void {
    root.innerHTML = iconMarkup(current);
    staticPose = pose;
  }
  async function ensureMotion(): Promise<MountedIcon | undefined> {
    if (disposed || !current.symbol) return undefined;
    if (mounted) return mounted;
    if (loading) {
      pendingState = !equalPose(staticPose, pose);
      syncReduced();
      return loading;
    }
    const epoch = generation;
    pendingState = !equalPose(staticPose, pose);
    loading = loadMotion()
      .then((executor) => {
        if (disposed || generation !== epoch || !current.symbol) return undefined;
        const next = executor.mount(root, current.symbol, staticPose);
        next.element.style.width = '100%';
        next.element.style.height = '100%';
        next.element.style.display = 'block';
        next.element.setAttribute('focusable', 'false');
        for (const child of Array.from(root.childNodes)) if (child !== next.element) child.remove();
        mounted = next;
        pendingState = false;
        if (!equalPose(staticPose, pose)) track(next.set(pose, timing()));
        syncReduced();
        return next;
      })
      .catch((error) => {
        // Optional motion must never hide the latest requested semantic state.
        if (!disposed && generation === epoch) {
          reset();
          writeStatic();
        }
        throw error;
      })
      .finally(() => {
        if (generation === epoch) {
          loading = undefined;
          pendingState = false;
          syncReduced();
        }
      });
    syncReduced();
    return loading;
  }
  async function playEffect(
    name: string,
    options: IconEffectOptions = {},
  ): Promise<SymbolPlayback | null> {
    const epoch = generation;
    const icon = await ensureMotion();
    if (!icon || disposed || generation !== epoch) return null;
    return track(
      icon.effect(name, {
        ...options,
        reducedMotion: current.reducedMotion || options.reducedMotion,
      }),
    );
  }
  // SSR's existing first frame is adopted; no parser/replacement on the static path.
  if (!root.firstElementChild && initial.symbol) writeStatic();
  if (initial.effect) void playEffect(initial.effect).catch(report);
  return {
    playEffect,
    update(next) {
      if (disposed) return;
      const previous = current;
      const before = pose;
      const target = iconRenderOptions(next);
      current = next;
      pose = target;
      if (previous.symbol !== next.symbol) {
        reset();
        writeStatic();
      } else if (!equalPose(before, pose)) {
        if (mounted) track(mounted.set(pose, timing()));
        else if (
          before.state !== pose.state ||
          before.variant !== pose.variant ||
          before.date?.getTime() !== pose.date?.getTime() ||
          before.timeZone !== pose.timeZone
        ) {
          // Resolving a reduced/static state does not need the motion module.
          const reducedNow =
            current.reducedMotion ||
            current.duration === 0 ||
            root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reducedNow) {
            reset();
            writeStatic();
          } else void ensureMotion().catch(report);
        } else writeStatic();
      } else if (next.reducedMotion && !previous.reducedMotion) {
        if (!mounted) {
          reset();
          writeStatic();
        } else finishActive();
      }
      if (
        next.effect &&
        (previous.effect !== next.effect ||
          previous.effectKey !== next.effectKey ||
          previous.symbol !== next.symbol)
      )
        void playEffect(next.effect).catch(report);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
    },
  };
}
