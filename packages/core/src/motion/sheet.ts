import { type MotionScope, scope } from '@labpics/motion';
import { createPan } from '@labpics/motion/gestures';
import { motionSemanticRuntime, motionSpringRuntime } from '@labpics/ui-tokens/motion';
import {
  type LabSheetPosition,
  type SheetGeometry,
  closestSheetPosition,
  sheetPositions,
} from '../components/sheet/positions.js';

export interface SheetMotion {
  update(open: boolean, position: LabSheetPosition): void;
  dispose(): void;
}

export interface SheetMotionOptions {
  readGeometry(): SheetGeometry;
  onPositionChange(position: LabSheetPosition): void;
  onOpenChange(open: boolean): void;
  onClosed(): void;
  onError(error: unknown): void;
}

/**
 * DOM связывается с публичным pan и scalar targets LabMotion. Один CSS scalar
 * держит Body у нижнего края и задаёт высоту Ghost без второго animator.
 */
export function mountSheetMotion(
  frame: HTMLElement,
  handle: HTMLElement,
  observed: readonly Element[],
  options: SheetMotionOptions,
): SheetMotion {
  const currentView = frame.ownerDocument.defaultView;
  if (!currentView) throw new Error('LabSheet: движение требует окно документа');
  const view = currentView;
  const motion: MotionScope = scope(frame);
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const original = frame.style.getPropertyValue('--_sheet-top');
  const originalPriority = frame.style.getPropertyPriority('--_sheet-top');
  let geometry = options.readGeometry();
  let open = false;
  let position: LabSheetPosition = 'half';
  let disposed = false;
  let generation = 0;
  let pointer: number | undefined;
  let origin = 0;
  let suppressClick = false;
  let lastGoal = geometry.viewport;
  let lastScale = -1;
  let role: keyof typeof motionSemanticRuntime = 'entrance';

  function readTop(): number {
    return Number.parseFloat(view.getComputedStyle(frame).getPropertyValue('--_sheet-top'));
  }

  function durationScale(): number {
    const raw = view
      .getComputedStyle(frame)
      .getPropertyValue(`--lab-motion-${role}-duration`)
      .trim();
    if (!raw) return 1;
    const milliseconds = Number.parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new TypeError(`LabSheet: неверная длительность ${raw}`);
    }
    return milliseconds / motionSemanticRuntime[role].durationMs;
  }

  function move(goal: number, snap = false): void {
    if (disposed) return;
    const currentGeneration = ++generation;
    const scale = durationScale();
    const spring = motionSpringRuntime.smooth;
    lastGoal = goal;
    lastScale = scale;
    const playback = motion.animate(
      frame,
      { '--_sheet-top': `${goal}px` },
      {
        spring: scale > 0 ? { response: spring.response * scale, bounce: spring.bounce } : spring,
        reducedMotion: snap || reduced.matches || scale === 0 ? 'always' : 'user',
      },
    );
    void playback.finished.then(
      (result) => {
        if (disposed || currentGeneration !== generation || result.status !== 'finished') return;
        if (!open && pointer === undefined) options.onClosed();
      },
      (error: unknown) => {
        if (!disposed && currentGeneration === generation) options.onError(error);
      },
    );
  }

  function releaseCapture(): void {
    const captured = pointer;
    pointer = undefined;
    if (captured !== undefined && handle.hasPointerCapture(captured)) {
      handle.releasePointerCapture(captured);
    }
    handle.removeAttribute('data-dragging');
  }

  function cancelGesture(): void {
    releaseCapture();
    pan.pointerCancel();
  }

  function choose(next: LabSheetPosition | 'closed'): void {
    if (next === 'closed') {
      open = false;
      role = 'exit';
      options.onOpenChange(false);
      move(geometry.viewport);
    } else {
      position = next;
      role = 'transition';
      options.onPositionChange(next);
      move(geometry.tops[next]);
    }
  }

  const pan = createPan({
    axis: 'y',
    onPanStart: () => {
      handle.setAttribute('data-dragging', '');
      suppressClick = true;
    },
    onPan: ({ dy }) => {
      const minimum = Math.min(...Object.values(geometry.tops));
      move(Math.min(geometry.viewport, Math.max(minimum, origin + dy)), true);
    },
    onPanEnd: () => {
      // createPan завершает и отменённый жест через onPanEnd. Отозванный
      // pointer не вправе фиксировать новую позицию.
      if (pointer === undefined) return;
      const next = closestSheetPosition(geometry, readTop(), position);
      releaseCapture();
      choose(next);
    },
  });

  const point = (event: PointerEvent) => ({
    x: event.clientX,
    y: event.clientY,
    t: event.timeStamp / 1000,
  });

  motion.on(handle, 'pointerdown', (event) => {
    if (disposed || pointer !== undefined || !event.isPrimary || event.button !== 0) return;
    geometry = options.readGeometry();
    origin = readTop();
    pointer = event.pointerId;
    suppressClick = false;
    // Прямой ввод принимает текущую позу. Распознавание принадлежит LabMotion;
    // при смене анимационной цели stop/[from,to] не используются.
    move(origin, true);
    if (!open) {
      open = true;
      options.onOpenChange(true);
    }
    handle.setPointerCapture(event.pointerId);
    pan.pointerDown(point(event));
  });
  motion.on(handle, 'pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    pan.pointerMove(point(event));
  });
  motion.on(handle, 'pointerup', (event) => {
    if (event.pointerId !== pointer) return;
    pan.pointerUp(point(event));
    releaseCapture();
  });
  const cancel = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    cancelGesture();
    move(open ? geometry.tops[position] : geometry.viewport);
  };
  motion.on(handle, 'pointercancel', cancel);
  motion.on(handle, 'lostpointercapture', cancel);

  function orderedPositions(): LabSheetPosition[] {
    return [...sheetPositions].sort((a, b) => geometry.tops[a] - geometry.tops[b]);
  }

  motion.on(handle, 'click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    geometry = options.readGeometry();
    const ordered = orderedPositions();
    const index = ordered.indexOf(position);
    choose(ordered[index > 0 ? index - 1 : ordered.length - 1] ?? position);
  });
  motion.on(handle, 'keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    suppressClick = false;
    cancelGesture();
    geometry = options.readGeometry();
    const ordered = orderedPositions();
    const index = ordered.indexOf(position);
    if (event.key === 'Home') choose('full');
    else if (event.key === 'End') choose('flex');
    else {
      const direction = event.key === 'ArrowUp' || event.key === 'PageUp' ? -1 : 1;
      choose(ordered[Math.min(ordered.length - 1, Math.max(0, index + direction))] ?? position);
    }
  });
  motion.on(reduced, 'change', () => {
    if (reduced.matches && pointer === undefined) {
      move(open ? geometry.tops[position] : geometry.viewport, true);
    }
  });

  function update(nextOpen: boolean, nextPosition: LabSheetPosition): void {
    if (disposed) return;
    const nextGeometry = options.readGeometry();
    const resized =
      nextGeometry.viewport !== geometry.viewport ||
      sheetPositions.some((value) => nextGeometry.tops[value] !== geometry.tops[value]);
    const retargeted = nextPosition !== position;
    if (pointer !== undefined && (!nextOpen || resized || retargeted)) cancelGesture();
    if (nextOpen !== open) role = nextOpen ? 'entrance' : 'exit';
    else if (resized || retargeted) role = 'transition';
    geometry = nextGeometry;
    open = nextOpen;
    position = nextPosition;
    if (pointer !== undefined) return;
    const goal = open ? geometry.tops[position] : geometry.viewport;
    if (goal !== lastGoal || durationScale() !== lastScale) move(goal);
  }

  const resize = new ResizeObserver(() => update(open, position));
  resize.observe(frame);
  for (const element of observed) resize.observe(element);
  motion.on(view, 'resize', () => update(open, position));
  if (view.visualViewport) motion.on(view.visualViewport, 'resize', () => update(open, position));
  frame.setAttribute('data-lab-motion', '');
  move(geometry.viewport, true);

  return {
    update,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation++;
      resize.disconnect();
      cancelGesture();
      motion.dispose();
      if (original) frame.style.setProperty('--_sheet-top', original, originalPriority);
      else frame.style.removeProperty('--_sheet-top');
      frame.removeAttribute('data-lab-motion');
    },
  };
}
