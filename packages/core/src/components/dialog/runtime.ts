import {
  type Placement,
  arrow,
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
} from '@floating-ui/dom';
import { type Playback, scope } from '@labpics/motion';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import { dialogProfile, motionSemanticRuntime } from '@labpics/ui-tokens';
import { bindDialogTriggerControls } from './focus.js';
import { mountNativeDialog } from './native.js';

export type LabDialogSize = 's' | 'm' | 'l';
export type LabDialogRole = 'dialog' | 'alertdialog';
export type LabPopoverPlacement = Placement;

export interface DialogOptions {
  open: boolean;
  modal: boolean;
  role: LabDialogRole;
  heading: boolean;
  description: boolean;
  ariaLabel: string;
  placement?: Placement;
  arrow?: boolean;
  initialFocus?(): HTMLElement | null;
  onOpenChange(open: boolean): void;
}

/** Browser modality traverses composed slots and keeps the consumer's DOM and
 * local theme intact. The application accepts open requests; Floating UI only runs
 * while an anchored panel is visible. React and Lit use this same lifecycle.
 */
export function mountDialog(
  trigger: HTMLButtonElement,
  plane: HTMLDialogElement,
  positioner: HTMLElement,
  surface: HTMLElement,
  initial: DialogOptions,
  controlsContainer: HTMLElement = plane,
) {
  let options = initial;
  let alive = true;
  let stopPosition: (() => void) | undefined;
  let stopMaterial: (() => void) | undefined;
  let placementRevision = 0;
  let updatePosition: (() => void) | undefined;
  const motion = scope(plane);
  let playback: Playback | undefined;
  let motionRevision = 0;
  let requestedOpen = false;
  const oldOpacity = plane.style.opacity;
  const id = plane.id || `lab-dialog-${crypto.randomUUID()}`;
  plane.id = id;
  const oldExpanded = trigger.getAttribute('aria-expanded');
  const oldPopup = trigger.getAttribute('aria-haspopup');
  const restoreControls = bindDialogTriggerControls(trigger, controlsContainer);
  const request = (open: boolean) => {
    if (open !== options.open) options.onOpenChange(open);
  };
  const activate = () => request(!options.open);
  trigger.addEventListener('click', activate);
  const boundary = mountNativeDialog(plane, {
    content: () => surface,
    trigger: () => trigger,
    initialFocus: () => options.initialFocus?.() ?? null,
    dismissOnOutside: () => options.role !== 'alertdialog',
    onDismiss: () => request(false),
  });
  const finishClose = () => {
    boundary.update(false, options.modal, false);
    placementRevision++;
    stopPosition?.();
    stopPosition = undefined;
    updatePosition = undefined;
    stopMaterial?.();
    stopMaterial = undefined;
  };
  const animate = (open: boolean) => {
    const revision = ++motionRevision;
    playback?.stop();
    const role = open ? 'entrance' : 'exit';
    const token = getComputedStyle(plane).getPropertyValue(`--lab-motion-${role}-duration`).trim();
    const measured = Number.parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    const duration =
      Number.isFinite(measured) && measured >= 0
        ? measured
        : motionSemanticRuntime[role].durationMs;
    const complete = () => {
      if (alive && revision === motionRevision && !options.open) finishClose();
    };
    try {
      playback = motion.animate(plane, { opacity: open ? 1 : 0 }, { duration, ease: 'linear' });
      void playback.finished.then(
        (result) => {
          if (result.status === 'finished') complete();
        },
        (error) => {
          complete();
          plane.dispatchEvent(
            new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
          );
        },
      );
    } catch (error) {
      plane.style.opacity = open ? '1' : '0';
      complete();
      plane.dispatchEvent(
        new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
      );
    }
  };
  const paint = () => {
    if (!alive) return;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', String(options.open));
    plane.setAttribute('role', options.role);
    plane.setAttribute('aria-modal', String(options.modal));
    if (options.heading) plane.setAttribute('aria-labelledby', `${id}-heading`);
    else plane.removeAttribute('aria-labelledby');
    if (options.description) plane.setAttribute('aria-describedby', `${id}-description`);
    else plane.removeAttribute('aria-describedby');
    if (!options.heading) plane.setAttribute('aria-label', options.ariaLabel);
    else plane.removeAttribute('aria-label');
    surface.dataset.state = options.open ? 'open' : 'closed';
    if (!options.open) {
      if (requestedOpen) {
        requestedOpen = false;
        if (plane.open) animate(false);
        else finishClose();
      }
      return;
    }
    const entering = !requestedOpen;
    requestedOpen = true;
    if (!plane.open) plane.style.opacity = '0';
    boundary.update(true, options.modal, true);
    stopMaterial ??= mountMaterialRuntime(surface);
    if (entering) animate(true);
    if (!options.placement || stopPosition) return;
    updatePosition = async () => {
      const tail = positioner.querySelector<HTMLElement>('.lab-popover-arrow');
      const revision = ++placementRevision;
      const rootSize =
        Number.parseFloat(getComputedStyle(plane.ownerDocument.documentElement).fontSize) / 16;
      const gap = dialogProfile.viewportGap * rootSize;
      // The positioner is a child of the top-layer dialog, so Floating UI's
      // element-only top-layer check cannot discard its former clipping parents.
      const overflow = {
        boundary: [] as Element[],
        rootBoundary: 'viewport' as const,
        padding: gap,
      };
      const result = await computePosition(trigger, positioner, {
        strategy: 'fixed',
        placement: options.placement,
        middleware: [
          offset(
            (dialogProfile.anchorGap + (options.arrow ? dialogProfile.actionGap : 0)) * rootSize,
          ),
          flip({ ...overflow, fallbackAxisSideDirection: 'end' }),
          shift({ ...overflow, crossAxis: true }),
          size({
            ...overflow,
            apply({ availableHeight }) {
              surface.style.setProperty(
                '--_lab-popover-available-height',
                `${Math.max(0, availableHeight)}px`,
              );
            },
          }),
          ...(tail && options.arrow
            ? [arrow({ element: tail, padding: dialogProfile.radius * rootSize })]
            : []),
        ],
      });
      if (!alive || !options.open || revision !== placementRevision) return;
      positioner.style.left = `${result.x}px`;
      positioner.style.top = `${result.y}px`;
      positioner.dataset.side = result.placement.split('-')[0];
      if (tail) {
        tail.style.left =
          result.middlewareData.arrow?.x === undefined ? '' : `${result.middlewareData.arrow.x}px`;
        tail.style.top =
          result.middlewareData.arrow?.y === undefined ? '' : `${result.middlewareData.arrow.y}px`;
      }
    };
    stopPosition = autoUpdate(trigger, positioner, updatePosition);
  };
  paint();
  return {
    request,
    update(next: DialogOptions) {
      options = next;
      paint();
      updatePosition?.();
    },
    dispose() {
      alive = false;
      placementRevision++;
      motionRevision++;
      motion.dispose();
      plane.style.opacity = oldOpacity;
      trigger.removeEventListener('click', activate);
      stopPosition?.();
      stopMaterial?.();
      boundary.dispose();
      restoreControls();
      if (oldExpanded === null) trigger.removeAttribute('aria-expanded');
      else trigger.setAttribute('aria-expanded', oldExpanded);
      if (oldPopup === null) trigger.removeAttribute('aria-haspopup');
      else trigger.setAttribute('aria-haspopup', oldPopup);
    },
  };
}
