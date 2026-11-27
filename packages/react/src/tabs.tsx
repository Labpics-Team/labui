'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type {
  LabTabsActivationMode,
  LabTabsEdge,
  LabTabsOrientation,
  LabTabsSize,
  LabTabsVariant,
} from '@labpics/ui-core/tabs';
import { mountTabsMotion } from '@labpics/ui-core/tabs/runtime';
import * as tabsMachine from '@zag-js/tabs';
import {
  Children,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
} from 'react';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/tabs.css';

type TabsSchema = SchemaOf<tabsMachine.Service>;
type TabsApi = tabsMachine.Api;
const tabsModule: MachineModule<TabsSchema, TabsApi> = tabsMachine;
const TabsContext = createContext<{ api: TabsApi; tabStop: string | undefined } | null>(null);

function useTabs(component: string) {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`<${component}> must be rendered inside <Tabs>.`);
  return context;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'dir'> {
  value?: string | null;
  defaultValue?: string | null;
  orientation?: LabTabsOrientation;
  size?: LabTabsSize;
  variant?: LabTabsVariant;
  edge?: LabTabsEdge;
  activationMode?: LabTabsActivationMode;
  dir?: 'ltr' | 'rtl';
  /** Accessible tablist name. */
  label?: string;
  onValueChange?: (value: string) => void;
}

export interface TabProps {
  value: string;
  disabled?: boolean;
  /** Required accessible name when iconOnly hides the visible label. */
  children?: ReactNode;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  iconOnly?: boolean;
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

function leaves(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? leaves(child.props.children)
      : [child],
  );
}

export function Tabs({
  value,
  defaultValue,
  orientation = 'horizontal',
  size = 'm',
  variant = 'underlined',
  edge = 'end',
  activationMode = 'automatic',
  onValueChange,
  children,
  dir = 'ltr',
  label,
  className,
  ...rest
}: TabsProps): ReactNode {
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef<ReturnType<typeof mountTabsMotion>>();
  const api = useZag(tabsModule, {
    id: useId(),
    value,
    defaultValue,
    orientation,
    activationMode,
    dir,
    translations: { listLabel: label ?? rest['aria-label'] },
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
  });
  const childArray = leaves(children);
  const triggers = childArray
    .filter(
      (child): child is ReactElement<TabProps> =>
        isValidElement<TabProps>(child) && child.type === Tab,
    )
    .map((child) => cloneElement(child, { key: child.props.value }));
  const panels = childArray
    .filter(
      (child): child is ReactElement<TabPanelProps> =>
        isValidElement<TabPanelProps>(child) && child.type === TabPanel,
    )
    .map((child) => cloneElement(child, { key: child.props.value }));
  const tabStop = (
    triggers.find((child) => child.props.value === api.focusedValue && !child.props.disabled) ??
    triggers.find((child) => child.props.value === api.value && !child.props.disabled) ??
    triggers.find((child) => !child.props.disabled)
  )?.props.value;
  useEffect(() => {
    if (!root.current) return;
    motion.current = mountTabsMotion(root.current);
    return () => {
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, []);
  useEffect(() => {
    motion.current?.update();
  });

  return (
    <TabsContext.Provider value={{ api, tabStop }}>
      <div
        {...rest}
        {...api.getRootProps()}
        ref={root}
        className={className}
        data-lab-tabs=""
        data-size={size}
        data-variant={variant}
        data-edge={edge}
        data-count={triggers.length}
      >
        <div {...api.getListProps()} className="lab-tabs-list">
          {triggers}
        </div>
        {panels}
      </div>
    </TabsContext.Provider>
  );
}

export function Tab({ value, disabled, children, icon, iconEnd, iconOnly }: TabProps): ReactNode {
  const { api, tabStop } = useTabs('Tab');
  return (
    <button
      {...api.getTriggerProps({ value, disabled })}
      tabIndex={value === tabStop ? 0 : -1}
      className="lab-tabs-trigger"
      data-icon-only={iconOnly ? '' : undefined}
    >
      <span className="lab-tabs-active" aria-hidden="true" />
      {icon && (
        <span className="lab-tabs-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="lab-tabs-label">{children}</span>
      {iconEnd && (
        <span className="lab-tabs-icon" aria-hidden="true">
          {iconEnd}
        </span>
      )}
    </button>
  );
}

export function TabPanel({ value, children, className, ...rest }: TabPanelProps): ReactNode {
  const { api } = useTabs('TabPanel');
  return (
    <div
      {...rest}
      {...api.getContentProps({ value })}
      aria-hidden={api.value !== value ? true : undefined}
      {...(api.value !== value ? { inert: '' } : {})}
      className={['lab-tabs-panel', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
