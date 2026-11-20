'use client';
import { type MenuOptions, mountMenu } from '@labpics/ui-core/menu/runtime';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/menu.css';

export type {
  LabMenuItem,
  LabMenubarItem,
  LabMenuTone,
  LabMenuPlacement,
} from '@labpics/ui-core/menu/runtime';
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export interface MenuProps
  extends Omit<
    MenuOptions,
    'variant' | 'menus' | 'value' | 'defaultValue' | 'onValueChange' | 'label'
  > {
  label?: string;
}
export interface ContextMenuProps extends MenuProps {
  children?: ReactNode;
}
export interface MenubarProps
  extends Omit<
    MenuOptions,
    'variant' | 'items' | 'heading' | 'open' | 'defaultOpen' | 'onOpenChange' | 'label'
  > {
  label?: string;
  menus: NonNullable<MenuOptions['menus']>;
}
function MenuFamily({ children, ...options }: MenuOptions & { children?: ReactNode }): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountMenu>>();
  const latest = useRef(options);
  latest.current = options;
  useClientLayoutEffect(() => {
    if (!host.current) return;
    controller.current = mountMenu(host.current, latest.current);
    return () => {
      controller.current?.dispose();
      controller.current = undefined;
    };
  }, []);
  useClientLayoutEffect(() => {
    controller.current?.update(options);
  });
  return (
    <div className="lab-menu-family" ref={host} dir={options.dir}>
      {options.variant === 'menubar' ? (
        <div
          data-menu-bar=""
          className="lab-menubar lab-material lab-material--soft"
          role="menubar"
          aria-label={options.label}
        >
          {options.menus?.map((root) => (
            <button
              key={root.value}
              type="button"
              className="lab-menubar-item"
              data-menu-root={root.value}
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={false}
              tabIndex={root === options.menus?.find((r) => !r.disabled) ? 0 : -1}
              disabled={root.disabled || options.disabled}
            >
              {root.label}
            </button>
          ))}
        </div>
      ) : options.variant === 'context' ? (
        <div
          data-menu-trigger=""
          className="lab-menu-context-trigger"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Context commands require keyboard invocation on the target region.
          tabIndex={0}
          aria-label={options.label}
        >
          {children ?? options.label}
        </div>
      ) : (
        <button
          data-menu-trigger=""
          type="button"
          className="lab-menu-trigger"
          disabled={options.disabled}
          aria-haspopup="menu"
          aria-expanded={false}
        >
          {options.label}
        </button>
      )}
      <div data-menu-panels="" />
    </div>
  );
}
export function Menu({ label = 'Menu', ...props }: MenuProps): ReactNode {
  return <MenuFamily {...props} variant="dropdown" label={label} />;
}
export function ContextMenu({ label = 'Context actions', ...props }: ContextMenuProps): ReactNode {
  return <MenuFamily {...props} variant="context" label={label} />;
}
export function Menubar({ label = 'Menu', ...props }: MenubarProps): ReactNode {
  return <MenuFamily {...props} items={[]} variant="menubar" label={label} />;
}
