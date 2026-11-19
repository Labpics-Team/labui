import {
  type Placement,
  arrow,
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
} from '@floating-ui/dom';
import { mountSurfaceShape } from '@labpics/ui-materials';
import { tooltipProfile } from '@labpics/ui-tokens';
import * as tooltip from '@zag-js/tooltip';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

export type LabTooltipPlacement = Placement;
export type LabTooltipSize = 's' | 'm' | 'l';
export type LabTooltipType = keyof typeof tooltipProfile.types;
export type LabTooltipTail = 'chevron' | 'bubble';

export interface TooltipOptions {
  placement: LabTooltipPlacement;
  openDelay: number;
  closeDelay: number;
  disabled: boolean;
  arrow: boolean;
  tail: LabTooltipTail;
  description(): string;
  descriptionNodes?(): Node[];
  onOpenChange?(open: boolean): void;
}

/** One lifecycle for React and custom elements. The actual control is the anchor;
 * the floating node stays in its local theme and uses the browser top layer.
 * Floating UI observes geometry only while visible. Zag owns delays and intent.
 */
export function mountTooltip(
  trigger: HTMLElement,
  positioner: HTMLElement,
  content: HTMLElement,
  tail: HTMLElement,
  initial: TooltipOptions,
) {
  let options = initial;
  let alive = true;
  let spreads: (() => void)[] = [];
  let stopShape: (() => void) | undefined;
  let descriptionObserver: MutationObserver | undefined;
  let descriptionNodes: Node[] = [];
  let refreshPosition: (() => void) | undefined;
  const id = `lab-tooltip-${crypto.randomUUID()}`;
  const contentId = `${id}-content`;
  const sameRoot = trigger.getRootNode() === content.getRootNode();
  // An ID reference cannot enter a descendant/sibling shadow tree. A hidden,
  // explicitly referenced text node in the control's own root is interoperable
  // with native ARIA, including Button's private native control.
  const description = sameRoot ? content : trigger.ownerDocument.createElement('span');
  if (!sameRoot) {
    description.id = `${id}-description`;
    description.hidden = true;
    description.setAttribute('role', 'tooltip');
    const root = trigger.getRootNode();
    // A light-DOM sibling inside lab-tooltip can be excluded from the composed
    // tree by slotting. Append to the actual root, where ARIA can resolve it.
    (root === trigger.ownerDocument ? trigger.ownerDocument.body : root).appendChild(description);
  }
  const syncDescription = () => {
    if (sameRoot) return;
    description.textContent = options.description();
    const nodes = [content, ...(options.descriptionNodes?.() ?? [])];
    if (
      nodes.length === descriptionNodes.length &&
      nodes.every((node, i) => node === descriptionNodes[i])
    )
      return;
    descriptionObserver ??= new MutationObserver(() => {
      description.textContent = options.description();
    });
    descriptionObserver.disconnect();
    descriptionNodes = nodes;
    for (const node of nodes)
      descriptionObserver.observe(node, { childList: true, characterData: true, subtree: true });
  };
  const stopDescription = () => {
    descriptionObserver?.disconnect();
    descriptionNodes = [];
  };
  const restoreDescription = () => {
    const other = (trigger.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((value) => value && value !== (sameRoot ? contentId : description.id));
    if (!other.length) trigger.removeAttribute('aria-describedby');
    else trigger.setAttribute('aria-describedby', other.join(' '));
  };
  // Store notifications and Vanilla sends are queued independently. Evaluate a
  // stale store close when its transition runs, after any intervening focus.
  const states = Object.fromEntries(
    Object.entries(tooltip.machine.states).map(([name, state]) => {
      const close = state.on?.close;
      return [
        name,
        close
          ? {
              ...state,
              on: {
                ...state.on,
                close: [
                  { guard: 'ignoreStaleStoreClose' },
                  ...(Array.isArray(close) ? close : [close]),
                ],
              },
            }
          : state,
      ];
    }),
  ) as typeof tooltip.machine.states;
  const behavior: typeof tooltip.machine = {
    ...tooltip.machine,
    states: {
      ...states,
      // Escape must also work during the pointer's trip across the gap.
      closing: {
        ...states.closing,
        effects: ['trackPositioning', 'waitForCloseDelay', 'trackEscapeKey'],
      },
    },
    implementations: {
      ...tooltip.machine.implementations,
      guards: {
        ...tooltip.machine.implementations?.guards,
        ignoreStaleStoreClose(args) {
          return (
            args.event.src === 'id.change' &&
            !!tooltip.machine.implementations?.guards?.isVisible?.(args)
          );
        },
      },
      effects: {
        ...tooltip.machine.implementations?.effects,
        trackStore(args) {
          const cleanup = tooltip.machine.implementations?.effects?.trackStore?.(args);
          // Upstream defers its subscription to a microtask. Match that ordering
          // on immediate StrictMode cleanup so no stopped machine stays subscribed.
          return () => {
            queueMicrotask(() => {
              if (typeof cleanup === 'function') cleanup();
            });
          };
        },
        trackPositioning({ context }) {
          let active = true;
          let revision = 0;
          let stop: (() => void) | undefined;
          // Zag enters before the renderer has exposed the popover. No idle RAF.
          queueMicrotask(() => {
            if (!active || !alive) return;
            const update = async () => {
              const request = ++revision;
              // The arrow middleware measures the correct cross-axis before the
              // first pass and after a live placement change.
              positioner.dataset.side = options.placement.split('-')[0];
              const result = await computePosition(trigger, positioner, {
                strategy: 'fixed',
                placement: options.placement,
                middleware: [
                  offset(
                    tooltipProfile.gap +
                      (options.arrow
                        ? options.tail === 'bubble'
                          ? tooltipProfile.tail.bubble.height
                          : tooltipProfile.tail.height
                        : 0),
                  ),
                  flip({ padding: 8 }),
                  shift({ padding: 8 }),
                  ...(options.arrow
                    ? [arrow({ element: tail, padding: tooltipProfile.padding })]
                    : []),
                  hide(),
                ],
              });
              if (!active || !alive || request !== revision) return;
              // WebKit can scroll a newly focused control after this first
              // measurement. Keep intent open so that scroll can reveal it.
              positioner.style.visibility = result.middlewareData.hide?.referenceHidden
                ? 'hidden'
                : '';
              positioner.style.left = `${result.x}px`;
              positioner.style.top = `${result.y}px`;
              const side = result.placement.split('-')[0];
              positioner.dataset.side = side;
              tail.style.left =
                result.middlewareData.arrow?.x === undefined
                  ? ''
                  : `${result.middlewareData.arrow.x}px`;
              tail.style.top =
                result.middlewareData.arrow?.y === undefined
                  ? ''
                  : `${result.middlewareData.arrow.y}px`;
              context.set('currentPlacement', result.placement);
            };
            refreshPosition = update;
            stop = autoUpdate(trigger, positioner, update);
          });
          return () => {
            active = false;
            refreshPosition = undefined;
            stop?.();
          };
        },
        trackEscapeKey({ send }) {
          const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.isComposing) return;
            event.preventDefault();
            event.stopPropagation();
            send({ type: 'close', src: 'keydown.escape' });
          };
          trigger.ownerDocument.addEventListener('keydown', onEscape, true);
          return () => trigger.ownerDocument.removeEventListener('keydown', onEscape, true);
        },
      },
    },
  };
  const props = () => ({
    id,
    ids: { content: contentId },
    getRootNode: () => trigger.getRootNode(),
    openDelay: options.openDelay,
    closeDelay: options.closeDelay,
    disabled: options.disabled,
    interactive: true, // hoverable text; this does not make the content focusable
    closeOnScroll: false,
    positioning: { placement: options.placement },
    onOpenChange: ({ open }: { open: boolean }) => options.onOpenChange?.(open),
  });
  const machine = new VanillaMachine(behavior, props);
  const paint = () => {
    if (!alive) return;
    for (const clean of spreads) clean();
    const api = tooltip.connect(machine.service, normalizeProps);
    const triggerProps = api.getTriggerProps();
    // The control keeps its own id, direction and component data-state. Zag's
    // event handlers need no synthetic trigger attributes for this single anchor.
    const triggerEvents = Object.fromEntries(
      Object.entries(triggerProps).filter(([, value]) => typeof value === 'function'),
    );
    const { style: _machineStyle, ...contentProps } = api.getContentProps();
    // Contour and positioning own their inline geometry. Spreading a style
    // attribute would erase that geometry on every state transition.
    // Preserve a consumer's description, and keep focused text open when the
    // pointer leaves. Native listeners leave the consumer's handlers intact.
    spreads = [
      spreadProps(trigger, {
        ...triggerEvents,
        onPointerLeave: () => {
          if (!trigger.matches(':focus-visible')) machine.send({ type: 'pointer.leave' });
        },
        onBlur: (event: FocusEvent) => {
          if (!trigger.matches(':hover') && !content.matches(':hover'))
            triggerProps.onBlur?.(event);
        },
      }),
      spreadProps(content, {
        ...contentProps,
        onPointerLeave: () => {
          if (!trigger.matches(':focus-visible')) machine.send({ type: 'content.pointer.leave' });
        },
      }),
    ];
    if (api.open) {
      syncDescription();
      restoreDescription();
      trigger.setAttribute(
        'aria-describedby',
        [trigger.getAttribute('aria-describedby'), sameRoot ? contentId : description.id]
          .filter(Boolean)
          .join(' '),
      );
      if (!positioner.matches(':popover-open')) positioner.showPopover();
      if (!stopShape) {
        const shape = mountSurfaceShape(content, { smoothing: tooltipProfile.cornerSmoothing });
        stopShape = () => shape.destroy();
      }
    } else {
      stopDescription();
      restoreDescription();
      if (positioner.matches(':popover-open')) positioner.hidePopover();
      stopShape?.();
      stopShape = undefined;
    }
  };
  const unsubscribe = machine.subscribe(paint);
  machine.start();
  paint();
  return {
    update(next: TooltipOptions) {
      const reposition =
        next.placement !== options.placement ||
        next.arrow !== options.arrow ||
        next.tail !== options.tail;
      options = next;
      machine.updateProps(props);
      paint();
      if (reposition) refreshPosition?.();
    },
    dispose() {
      alive = false;
      // Close before stopping: Zag releases the global single-open identity.
      machine.send({ type: 'close' });
      unsubscribe();
      machine.stop();
      for (const clean of spreads) clean();
      if (positioner.matches(':popover-open')) positioner.hidePopover();
      stopShape?.();
      stopDescription();
      restoreDescription();
      if (!sameRoot) description.remove();
    },
  };
}
