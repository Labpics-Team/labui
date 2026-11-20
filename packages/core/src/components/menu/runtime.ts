import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import { symbol as chevronForward } from '@labpics/icons/symbols/chevron-forward';
import { mountMaterialRuntime, mountSurfaceShape } from '@labpics/ui-materials';
import { menuProfile } from '@labpics/ui-tokens';
import * as menu from '@zag-js/menu';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import type { SchemaOf } from '../../behaviors/types.js';
import { iconMarkup } from '../icon/runtime.js';
import {
  type LabMenuItem,
  type LabMenuPlacement,
  type LabMenubarItem,
  type MenuModel,
  type MenuPanel,
  changeMenuChecked,
  menuCheckedValues,
  menuModel,
} from './contract.js';

export * from './contract.js';
export type MenuVariant = 'dropdown' | 'context' | 'menubar';
export interface MenuOptions {
  variant: MenuVariant;
  items: readonly LabMenuItem[];
  menus?: readonly LabMenubarItem[];
  label: string;
  heading?: string;
  placement?: LabMenuPlacement;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
  open?: boolean;
  defaultOpen?: boolean;
  /** Menubar's currently open entry. Null closes every entry. */
  value?: string | null;
  defaultValue?: string | null;
  checkedValues?: readonly string[];
  defaultCheckedValues?: readonly string[];
  onOpenChange?(open: boolean): void;
  onValueChange?(value: string | null): void;
  onCheckedValuesChange?(values: readonly string[]): void;
  onSelect?(value: string): void;
}

type MenuMachine = VanillaMachine<SchemaOf<menu.Service>>;
interface PanelRuntime {
  panel: MenuPanel;
  positioner: HTMLDivElement;
  surfaceNode: HTMLDivElement;
  content: HTMLDivElement;
  trigger: HTMLElement;
  machine: MenuMachine;
  unsubscribe: () => void;
  surface?: () => void;
  rows: Map<string, HTMLElement>;
}

function requireMenuPart<T>(value: T | null | undefined): T {
  if (value == null) throw new TypeError('Menu tree and rendered controls must match');
  return value;
}

/** Panels have one Zag service each. Both renderers delegate the complete DOM
 * lifecycle here; changing their render scheduling cannot change menu behavior.
 * Local manual popovers retain theme inheritance and work above native dialogs.
 */
export function mountMenu(host: HTMLElement, initial: MenuOptions) {
  let options = initial;
  let model: MenuModel;
  let alive = true;
  let queued = false;
  let paintQueued = false;
  let synchronizing = false;
  let internalOpen = initial.defaultOpen ?? false;
  let internalValue = initial.defaultValue ?? null;
  let internalChecked = initial.defaultCheckedValues ?? [];
  let rovingValue: string | undefined;
  let contextKeyboardTarget: HTMLElement | undefined;
  let contextWasOpen = false;
  const id = `lab-menu-${crypto.randomUUID()}`;
  const doc = host.ownerDocument;
  // A disposed machine can finish a deferred focus lookup after React removes
  // its host. Retain the mounted query scope for that runtime's whole lifetime.
  const rootNode = host.getRootNode() as Document | ShadowRoot;
  const panelsRoot = requireMenuPart(host.querySelector<HTMLElement>('[data-menu-panels]'));
  const trigger = host.querySelector<HTMLElement>('[data-menu-trigger]');
  const bar = host.querySelector<HTMLElement>('[data-menu-bar]');
  const panels = new Map<string, PanelRuntime>();
  const barTriggers = new Map<string, HTMLButtonElement>();
  const spreads = new Map<HTMLElement, () => void>();
  let topology = '';
  const spread = (node: HTMLElement, attrs: Record<string, unknown>) => {
    spreads.set(node, spreadProps(node, attrs));
  };
  const element = (className: string) => {
    const node = doc.createElement('div');
    node.className = className;
    return node;
  };
  const currentValue = () => (options.value === undefined ? internalValue : options.value);
  const isOpen = (panel: MenuPanel) =>
    !options.disabled &&
    (options.variant === 'menubar'
      ? currentValue() === panel.triggerValue &&
        !model.roots.find((r) => r.value === panel.triggerValue)?.disabled
      : (options.open ?? internalOpen));
  const checked = () => menuCheckedValues(model, options.checkedValues ?? internalChecked);
  const direction = () =>
    options.dir ?? (getComputedStyle(host).direction === 'rtl' ? 'rtl' : 'ltr');
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (alive) sync();
    });
  };
  const requestPaint = () => {
    if (synchronizing || paintQueued) return;
    paintQueued = true;
    queueMicrotask(() => {
      if (!paintQueued || !alive) return;
      paintQueued = false;
      paint();
    });
  };
  const requestValue = (value: string | null) => {
    if (currentValue() === value) return;
    if (options.value === undefined) internalValue = value;
    options.onValueChange?.(value);
    schedule();
  };
  const props = (panel: MenuPanel): menu.Props => ({
    id: `${id}-${panel.key}`,
    ids: {
      trigger: `${id}-trigger-${panel.key}`,
      contextTrigger: `${id}-context-${panel.key}`,
      content: `${id}-content-${panel.key}`,
      positioner: `${id}-positioner-${panel.key}`,
    },
    getRootNode: () => rootNode,
    dir: direction(),
    'aria-label': panel.label,
    positioning: {
      placement: options.placement ?? 'bottom-start',
      strategy: 'fixed',
      gutter: menuProfile.gap,
      ...(bar && !panel.parent
        ? {
            getAnchorRect: () => {
              const node = barTriggers.get(requireMenuPart(panel.triggerValue));
              if (!node) return null;
              const rect = node.getBoundingClientRect();
              const padding = Number.parseFloat(getComputedStyle(bar).paddingTop);
              return {
                x: rect.x - padding,
                y: rect.y - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
              };
            },
          }
        : {}),
    },
    loopFocus: true,
    ...(panel.parent ? {} : { open: isOpen(panel) }),
    onOpenChange: ({ open }) => {
      if (panel.parent) {
        schedule();
        return;
      }
      if (options.variant === 'menubar') {
        if (open) requestValue(requireMenuPart(panel.triggerValue));
        else if (currentValue() === panel.triggerValue) requestValue(null);
      } else {
        if (options.open === undefined) internalOpen = open;
        options.onOpenChange?.(open);
        schedule();
      }
    },
    onSelect: ({ value }) => {
      const item = model.items.get(value);
      if (item && item.kind !== 'separator' && item.kind !== 'submenu' && !item.disabled)
        options.onSelect?.(value);
    },
  });
  const api = (panel: PanelRuntime) => menu.connect(panel.machine.service, normalizeProps);
  const cleanSurface = (p: PanelRuntime) => {
    if (p.positioner.matches(':popover-open')) p.positioner.hidePopover();
    p.surface?.();
    p.surface = undefined;
  };
  const clearPanels = () => {
    for (const p of [...panels.values()].reverse()) {
      p.unsubscribe();
      p.machine.stop();
      cleanSurface(p);
      for (const node of [p.content, p.positioner, ...p.rows.values()]) {
        spreads.get(node)?.();
        spreads.delete(node);
      }
      p.positioner.remove();
    }
    panels.clear();
  };
  const addIcon = (
    node: HTMLElement,
    symbol: NonNullable<Extract<LabMenuItem, { label: string }>['icon']>,
    classes = '',
    variant?: Extract<LabMenuItem, { label: string }>['iconVariant'],
  ) => {
    const icon = doc.createElement('span');
    icon.className = `lab-menu-icon ${classes}`;
    icon.setAttribute('aria-hidden', 'true');
    // iconMarkup accepts imported symbol packets only; labels never enter HTML.
    icon.innerHTML = iconMarkup({ symbol, variant, size: menuProfile.row.iconSize });
    node.append(icon);
    return icon;
  };
  const paintRow = (node: HTMLElement, item: LabMenuItem) => {
    node.replaceChildren();
    node.dataset.menuValue = item.value;
    if (item.kind === 'separator') {
      node.className = 'lab-menu-separator';
      return;
    }
    node.className = 'lab-menu-item';
    node.dataset.tone = item.type ?? 'neutral';
    node.toggleAttribute(
      'data-leading',
      !!item.icon || item.kind === 'check' || item.kind === 'radio',
    );
    if (item.kind === 'check' || item.kind === 'radio') {
      const leading = element('lab-menu-icon lab-menu-leading lab-menu-selection');
      leading.setAttribute('aria-hidden', 'true');
      if (item.icon) addIcon(leading, item.icon, 'lab-menu-icon-fallback', item.iconVariant);
      if (item.kind === 'check') addIcon(leading, checkmark, 'lab-menu-indicator');
      else {
        const mark = element('lab-menu-icon lab-menu-indicator');
        mark.append(element('lab-menu-radio-dot'));
        leading.append(mark);
      }
      node.append(leading);
    } else if (item.icon) addIcon(node, item.icon, 'lab-menu-leading', item.iconVariant);
    const label = doc.createElement('span');
    label.className = 'lab-menu-label';
    label.textContent = item.label;
    node.append(label);
    if (item.shortcut?.length || item.iconEnd || item.kind === 'submenu') {
      const accessory = element('lab-menu-accessory');
      accessory.setAttribute('aria-hidden', 'true');
      if (item.shortcut?.length) {
        const chord = doc.createElement('span');
        chord.dataset.labKbd = '';
        chord.dataset.size = 's';
        for (const key of item.shortcut) {
          const kbd = doc.createElement('kbd');
          kbd.className = 'lab-kbd-key';
          kbd.textContent = key;
          chord.append(kbd);
        }
        accessory.append(chord);
      }
      if (item.iconEnd) addIcon(accessory, item.iconEnd, '', item.iconEndVariant);
      if (item.kind === 'submenu') addIcon(accessory, chevronForward, 'lab-menu-chevron');
      node.append(accessory);
    }
  };
  const rowData = new WeakMap<HTMLElement, LabMenuItem>();
  const renderStructure = () => {
    if (bar) {
      bar.setAttribute('aria-label', options.label);
      for (const [value, node] of barTriggers)
        if (!model.roots.some((root) => root.value === value)) {
          spreads.get(node)?.();
          spreads.delete(node);
          barTriggers.delete(value);
        }
      const enabled = model.roots.filter((root) => !root.disabled && !options.disabled);
      if (!enabled.some((root) => root.value === rovingValue)) rovingValue = enabled[0]?.value;
      for (const root of model.roots) {
        const node = bar.querySelector<HTMLButtonElement>(
          `[data-menu-root="${CSS.escape(root.value)}"]`,
        );
        if (!node) {
          throw new TypeError(`Menubar is missing its rendered control: ${root.value}`);
        }
        barTriggers.set(root.value, node);
        node.disabled = !!root.disabled || !!options.disabled;
        node.tabIndex = root.value === rovingValue ? 0 : -1;
      }
    }
    const nextTopology = model.panels.map((p) => `${p.key}\0${p.parent ?? ''}`).join('\n');
    if (topology !== nextTopology) {
      clearPanels();
      topology = nextTopology;
    }
    for (const panel of model.panels) {
      let runtime = panels.get(panel.key);
      if (!runtime) {
        const positioner = element('lab-menu-positioner');
        positioner.setAttribute('popover', 'manual');
        const surfaceNode = element('lab-menu-surface lab-material lab-material--elevated');
        const content = element('lab-menu-content');
        content.hidden = true;
        surfaceNode.append(content);
        positioner.append(surfaceNode);
        panelsRoot.append(positioner);
        const machine = new VanillaMachine<SchemaOf<menu.Service>>(menu.machine, () =>
          props(panels.get(panel.key)?.panel ?? panel),
        );
        runtime = {
          panel,
          positioner,
          surfaceNode,
          content,
          trigger: host,
          machine,
          rows: new Map(),
          unsubscribe: () => {},
        };
        panels.set(panel.key, runtime);
      }
      runtime.panel = panel;
      runtime.content.dataset.variant = options.variant;
      runtime.surfaceNode.dataset.variant = options.variant;
      // Keep a stable row node and ID when text, order or checked state changes.
      const wanted = new Set(panel.items.map((item) => item.value));
      for (const [value, node] of runtime.rows)
        if (!wanted.has(value)) {
          spreads.get(node)?.();
          spreads.delete(node);
          node.remove();
          runtime.rows.delete(value);
        }
      runtime.content.querySelector('[data-menu-heading]')?.remove();
      if (panel.heading) {
        const heading = element('lab-menu-heading');
        heading.dataset.menuHeading = '';
        heading.textContent = panel.heading;
        const wrapper = element('');
        wrapper.dataset.menuHeading = '';
        wrapper.append(heading);
        const separator = element('lab-menu-separator');
        separator.setAttribute('role', 'separator');
        wrapper.append(separator);
        runtime.content.prepend(wrapper);
      }
      for (const item of panel.items) {
        let node = runtime.rows.get(item.value);
        if (!node) {
          node = element('');
          runtime.rows.set(item.value, node);
        }
        if (rowData.get(node) !== item) {
          paintRow(node, item);
          rowData.set(node, item);
        }
        runtime.content.append(node);
      }
    }
    for (const p of panels.values()) {
      p.trigger = p.panel.parent
        ? requireMenuPart(
            requireMenuPart(panels.get(p.panel.parent)).rows.get(
              requireMenuPart(p.panel.triggerValue),
            ),
          )
        : bar
          ? requireMenuPart(barTriggers.get(requireMenuPart(p.panel.triggerValue)))
          : requireMenuPart(trigger);
    }
  };
  const startGraph = () => {
    for (const p of panels.values()) {
      p.unsubscribe = p.machine.subscribe(requestPaint);
      p.machine.start();
    }
    for (const p of panels.values()) {
      if (p.panel.parent) {
        const parent = requireMenuPart(panels.get(p.panel.parent));
        api(parent).setChild(p.machine.service);
        api(p).setParent(parent.machine.service);
      }
    }
  };
  function paint() {
    if (!alive) return;
    const values = new Set(checked());
    for (const p of panels.values()) {
      const connected = api(p);
      if (options.variant === 'context' && !p.panel.parent) {
        if (contextWasOpen && !connected.open && contextKeyboardTarget) {
          const target = contextKeyboardTarget;
          contextKeyboardTarget = undefined;
          const active = rootNode.activeElement;
          // Zag skips restoration for coordinate-anchored context menus. A
          // keyboard invocation still returns to its target, unless focus has
          // already moved outside the menu tree (for example after Tab/click).
          if (active && [...panels.values()].some((panel) => panel.content.contains(active)))
            queueMicrotask(() => {
              if (alive && !api(p).open && target.isConnected)
                target.focus({ preventScroll: true });
            });
        }
        contextWasOpen = connected.open;
      }
      // Vanilla applies style properties individually, preserving Popper's
      // measured CSS variables when its positioner declarations are refreshed.
      spread(p.positioner, connected.getPositionerProps());
      spread(p.content, connected.getContentProps());
      if (!p.panel.parent) {
        if (options.variant === 'context') {
          const { style: _style, ...contextProps } = connected.getContextTriggerProps();
          const attrs = options.disabled
            ? Object.fromEntries(Object.entries(contextProps).filter(([k]) => !k.startsWith('on')))
            : contextProps;
          spread(p.trigger, {
            ...attrs,
            'aria-haspopup': 'menu',
            'aria-expanded': connected.open,
            'aria-controls': p.content.id,
            'aria-disabled': options.disabled || undefined,
          });
        } else {
          spread(p.trigger, {
            ...connected.getTriggerProps(),
            ...(bar
              ? { role: 'menuitem', tabindex: p.panel.triggerValue === rovingValue ? 0 : -1 }
              : {}),
          });
        }
      }
      for (const item of p.panel.items) {
        const node = requireMenuPart(p.rows.get(item.value));
        if (item.kind === 'separator') {
          spread(node, connected.getSeparatorProps());
          continue;
        }
        const common = {
          value: item.value,
          valueText: item.label,
          disabled: item.disabled,
          closeOnSelect: 'closeOnSelect' in item ? item.closeOnSelect : undefined,
        };
        if (item.kind === 'submenu') {
          const child = requireMenuPart(panels.get(`submenu:${item.value}`));
          const attrs = connected.getTriggerItemProps(api(child));
          if (item.disabled)
            for (const key of Object.keys(attrs)) if (key.startsWith('on')) delete attrs[key];
          spread(node, {
            ...attrs,
            'data-valuetext': item.label,
            'aria-disabled': item.disabled || undefined,
            'data-disabled': item.disabled || undefined,
          });
        } else if (item.kind === 'check' || item.kind === 'radio') {
          spread(
            node,
            connected.getOptionItemProps({
              ...common,
              type: item.kind === 'check' ? 'checkbox' : 'radio',
              checked: values.has(item.value),
              onCheckedChange(value) {
                const next = changeMenuChecked(model, checked(), item.value, value);
                if (options.checkedValues === undefined) internalChecked = next;
                options.onCheckedValuesChange?.(next);
                schedule();
              },
            }),
          );
        } else spread(node, connected.getItemProps(common));
      }
      if (connected.open) {
        if (!p.positioner.matches(':popover-open')) {
          p.positioner.showPopover();
          // Context-menu positioning is a one-shot operation. Its first anchor
          // update can precede top-layer visibility, so measure after showing.
          if (options.variant === 'context' && !p.panel.parent) connected.reposition();
        }
        if (!p.surface) {
          const shape = mountSurfaceShape(p.surfaceNode, {
            smoothing: menuProfile.cornerSmoothing,
          });
          const material = mountMaterialRuntime(p.surfaceNode);
          p.surface = () => {
            material();
            shape.destroy();
          };
        }
      } else cleanSurface(p);
    }
  }
  function sync() {
    // The constructor getter stays live. An empty object notifies Zag's watchers
    // without registering another additive getter on every renderer update.
    synchronizing = true;
    try {
      for (const p of panels.values()) p.machine.updateProps({});
    } finally {
      synchronizing = false;
    }
    paintQueued = false;
    paint();
  }
  const switchBar = (value: string, focusMenu: boolean) => {
    rovingValue = value;
    if (focusMenu) {
      requestValue(value);
      queueMicrotask(() => {
        if (alive) panels.get(`root:${value}`)?.machine.send({ type: 'OPEN_AUTOFOCUS' });
      });
    } else barTriggers.get(value)?.focus();
    paint();
  };
  const onKey = (event: KeyboardEvent) => {
    if (options.disabled || event.isComposing || event.defaultPrevented) return;
    if (
      options.variant === 'context' &&
      (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
    ) {
      if (!trigger || !event.composedPath().includes(trigger)) return;
      event.preventDefault();
      contextKeyboardTarget = trigger;
      const rect = trigger.getBoundingClientRect();
      panels.get('root')?.machine.send({
        type: 'CONTEXT_MENU',
        point: { x: direction() === 'rtl' ? rect.right : rect.left, y: rect.bottom },
      });
      return;
    }
    if (!bar) return;
    const target = event.target as HTMLElement;
    const root = target.closest<HTMLElement>('[data-menu-root]');
    const activePanel = [...panels.values()].find((p) => p.content === target);
    if (!root && !activePanel) return;
    const forward = direction() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = direction() === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (!root && activePanel) {
      // Zag owns submenu open/back navigation. Horizontal root navigation only
      // applies when no submenu can consume the arrow.
      const selected = api(activePanel).highlightedValue;
      const row = [...activePanel.rows.values()].find((n) => n.dataset.value === selected);
      if (
        (activePanel.panel.parent && event.key !== forward) ||
        (event.key === forward && row?.getAttribute('aria-haspopup') === 'menu')
      )
        return;
    }
    const enabled = model.roots.filter((r) => !r.disabled);
    const index = enabled.findIndex((r) => r.value === (root?.dataset.menuRoot ?? currentValue()));
    let next: LabMenubarItem | undefined;
    if (event.key === forward) next = enabled[(index + 1) % enabled.length];
    else if (event.key === backward) next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (root && event.key === 'Home') next = enabled[0];
    else if (root && event.key === 'End') next = enabled.at(-1);
    if (next) {
      event.preventDefault();
      event.stopPropagation();
      switchBar(next.value, !!currentValue());
    }
    if (root && event.key === 'Escape') {
      event.preventDefault();
      requestValue(null);
    }
  };
  const onHover = (event: PointerEvent) => {
    if (!bar || event.pointerType !== 'mouse' || !currentValue() || options.disabled) return;
    const node = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-menu-root]');
    if (node && !node.disabled && node.dataset.menuRoot !== currentValue())
      switchBar(requireMenuPart(node.dataset.menuRoot), true);
  };
  const onFocus = (event: FocusEvent) => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-menu-root]');
    if (node) {
      rovingValue = node.dataset.menuRoot;
      paint();
    }
  };
  host.addEventListener('keydown', onKey, true);
  host.addEventListener('pointermove', onHover, true);
  host.addEventListener('focusin', onFocus);
  let disposeBar: (() => void) | undefined;
  if (bar) {
    const shape = mountSurfaceShape(bar, { smoothing: menuProfile.cornerSmoothing });
    const material = mountMaterialRuntime(bar);
    disposeBar = () => {
      material();
      shape.destroy();
    };
  }
  const update = (next: MenuOptions) => {
    const nextModel = menuModel(
      next.items,
      next.label,
      next.heading,
      next.variant === 'menubar' ? (next.menus ?? []) : undefined,
    );
    options = next;
    model = nextModel;
    const previousTopology = topology;
    renderStructure();
    if (previousTopology !== topology) startGraph();
    sync();
    const available = new Set<string>();
    for (const p of panels.values()) {
      const parentItem = p.panel.triggerValue ? model.items.get(p.panel.triggerValue) : undefined;
      if (
        p.panel.parent &&
        (!available.has(p.panel.parent) ||
          (parentItem && 'disabled' in parentItem && parentItem.disabled))
      ) {
        api(p).setOpen(false);
      } else available.add(p.panel.key);
    }
    // A removed/disabled highlighted row must not leave a dangling ARIA target.
    for (const p of panels.values()) {
      const connected = api(p);
      if (
        connected.highlightedValue &&
        ![...p.rows.values()].some(
          (n) => n.dataset.value === connected.highlightedValue && !n.hasAttribute('data-disabled'),
        )
      )
        p.machine.send({ type: 'HIGHLIGHTED.SET', value: null });
    }
  };
  update(initial);
  return {
    update,
    dispose() {
      alive = false;
      clearPanels();
      host.removeEventListener('keydown', onKey, true);
      host.removeEventListener('pointermove', onHover, true);
      host.removeEventListener('focusin', onFocus);
      for (const clean of spreads.values()) clean();
      spreads.clear();
      disposeBar?.();
    },
  };
}
