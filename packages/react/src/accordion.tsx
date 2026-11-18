'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabAccordionOrientation, LabAccordionSize } from '@labpics/ui-core/accordion';
import { mountAccordionMotion } from '@labpics/ui-core/accordion/runtime';
import * as accordionMachine from '@zag-js/accordion';
import {
  Children,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  createContext,
  isValidElement,
  useContext,
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/accordion.css';

type AccordionSchema = SchemaOf<accordionMachine.Service>;
type AccordionApi = accordionMachine.Api;
const accordionModule: MachineModule<AccordionSchema, AccordionApi> = accordionMachine;
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const AccordionContext = createContext<{
  api: AccordionApi;
  headingLevel: number;
  regions: boolean;
} | null>(null);

export interface AccordionProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  value?: string[];
  defaultValue?: string[];
  multiple?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  orientation?: LabAccordionOrientation;
  size?: LabAccordionSize;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  onValueChange?: (value: string[]) => void;
}
export interface AccordionItemProps {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}

function countItems(children: ReactNode): number {
  return Children.toArray(children).reduce<number>((count, child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return count;
    return count + (child.type === Fragment ? countItems(child.props.children) : 1);
  }, 0);
}

export function Accordion({
  value,
  defaultValue,
  multiple = false,
  collapsible = true,
  disabled = false,
  orientation = 'vertical',
  size = 'm',
  headingLevel = 3,
  onValueChange,
  children,
  ...rest
}: AccordionProps): ReactNode {
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef<ReturnType<typeof mountAccordionMotion>>();
  const api = useZag(accordionModule, {
    id: useId(),
    value,
    defaultValue,
    multiple,
    collapsible,
    disabled,
    orientation,
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
  });
  useClientLayoutEffect(() => {
    if (!root.current) return;
    motion.current = mountAccordionMotion(root.current);
    return () => {
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, []);
  useClientLayoutEffect(() => {
    motion.current?.update();
  });
  return (
    <AccordionContext.Provider
      value={{ api, headingLevel, regions: !multiple || countItems(children) <= 6 }}
    >
      <div {...rest} {...api.getRootProps()} ref={root} data-lab-accordion="" data-size={size}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ value, label, disabled, children }: AccordionItemProps): ReactNode {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('<AccordionItem> must be rendered inside <Accordion>.');
  const { api, headingLevel, regions } = context;
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const item = { value, disabled };
  const open = api.value.includes(value);
  return (
    <div {...api.getItemProps(item)} className="lab-accordion-item">
      <Heading className="lab-accordion-heading">
        <button
          {...api.getItemTriggerProps(item)}
          className="lab-accordion-trigger"
          onClickCapture={(event) => {
            if (!event.currentTarget.disabled && document.activeElement !== event.currentTarget)
              event.currentTarget.focus();
          }}
        >
          <span className="lab-accordion-label">{label}</span>
          <span
            {...api.getItemIndicatorProps(item)}
            className="lab-accordion-indicator"
            aria-hidden="true"
          />
        </button>
      </Heading>
      <div
        {...api.getItemContentProps(item)}
        role={regions ? 'region' : undefined}
        {...(!open ? { inert: '' } : {})}
        aria-hidden={!open || undefined}
        className="lab-accordion-content"
      >
        <div className="lab-accordion-body">{children}</div>
      </div>
    </div>
  );
}
