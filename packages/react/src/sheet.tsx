/** Native React Sheet: Core Dialog владеет модальностью, Core Motion — позой и жестом. */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import * as dialogMachine from '@labpics/ui-core/behaviors/dialog';
import { type SheetMotion, mountSheetMotion } from '@labpics/ui-core/motion';
import { type LabSheetPosition, parseSheetPosition, sheetGeometry } from '@labpics/ui-core/shared';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '@labpics/ui-materials/material.css';
import { DialogPortalPlane } from './components/dialog-portal-plane.js';
import { useZag } from './use-zag.js';
import './sheet.css';

export type { LabSheetPosition } from '@labpics/ui-core/shared';

type DialogSchema = SchemaOf<dialogMachine.Service>;
const dialogModule: MachineModule<DialogSchema, dialogMachine.Api> = dialogMachine;
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface SheetProps {
  /** Содержимое панели; сохраняет React state и обработчики событий. */
  content?: ReactNode;
  heading?: ReactNode;
  description?: ReactNode;
  /** Управляемое открытие; без этого свойства состоянием владеет компонент. */
  open?: boolean;
  defaultOpen?: boolean;
  /** Управляемая позиция. Начальная неуправляемая позиция — half. */
  position?: LabSheetPosition;
  defaultPosition?: LabSheetPosition;
  /** Focus trap, блокировка фона и scroll lock; по умолчанию true. */
  modal?: boolean;
  /** Встроенная кнопка закрытия; по умолчанию false. */
  closable?: boolean;
  /** Имя панели без видимого heading; по умолчанию «Панель». */
  'aria-label'?: string;
  onOpenChange?: (open: boolean) => void;
  onPositionChange?: (position: LabSheetPosition) => void;
  onMotionError?: (error: unknown) => void;
  /** Содержимое доступной кнопки открытия, как у Dialog. */
  children?: ReactNode;
}

export function Sheet({
  content,
  heading,
  description,
  open,
  defaultOpen = false,
  position,
  defaultPosition = 'half',
  modal = true,
  closable = false,
  'aria-label': ariaLabel,
  onOpenChange,
  onPositionChange,
  onMotionError,
  children,
}: SheetProps): ReactNode {
  if (open !== undefined && typeof open !== 'boolean') {
    throw new TypeError('LabSheet: open должен быть Boolean');
  }
  const [localOpen, setLocalOpen] = useState(() => {
    if (typeof defaultOpen !== 'boolean')
      throw new TypeError('LabSheet: defaultOpen должен быть Boolean');
    return { open: defaultOpen };
  });
  const [localPosition, setLocalPosition] = useState(() => ({
    position: parseSheetPosition(defaultPosition),
  }));
  const requestedOpen = open ?? localOpen.open;
  const selectedPosition =
    position === undefined ? localPosition.position : parseSheetPosition(position);
  const [present, setPresent] = useState(false);
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false);
  const effectiveOpen = requestedOpen && !failed;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const trigger = useRef<HTMLButtonElement>(null);
  const positioner = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const motion = useRef<SheetMotion>();
  const disposeMaterial = useRef<() => void>();
  const latest = useRef({
    requestedOpen,
    effectiveOpen,
    selectedPosition,
    onOpenChange,
    onPositionChange,
    onMotionError,
  });
  latest.current = {
    requestedOpen,
    effectiveOpen,
    selectedPosition,
    onOpenChange,
    onPositionChange,
    onMotionError,
  };

  function changeOpen(next: boolean): void {
    if (next) {
      failedRef.current = false;
      setFailed(false);
    }
    // Даже при veto controlled consumer получает commit, возвращающий Motion его целью.
    setLocalOpen({ open: next });
    if (next !== latest.current.requestedOpen) latest.current.onOpenChange?.(next);
  }

  function changePosition(next: LabSheetPosition): void {
    if (next === latest.current.selectedPosition) return;
    setLocalPosition({ position: next });
    latest.current.onPositionChange?.(next);
  }

  function motionFailed(error: unknown): void {
    if (failedRef.current) return;
    failedRef.current = true;
    setFailed(true);
    setPresent(false);
    changeOpen(false);
    latest.current.onMotionError?.(error);
  }

  const hasHeading = heading != null && typeof heading !== 'boolean' && heading !== '';
  const hasDescription =
    description != null && typeof description !== 'boolean' && description !== '';
  const api = useZag(dialogModule, {
    id: useId(),
    role: 'dialog',
    modal,
    // Exit сохраняет владельца trap/focus до onClosed существующего Motion scope.
    open: mounted && (effectiveOpen || present),
    'aria-label': ariaLabel ?? (hasHeading ? undefined : 'Панель'),
    triggerEl: () => trigger.current,
    onOpenChange: (details) => changeOpen(details.open),
  });

  useClientLayoutEffect(() => {
    if (!requestedOpen && failed) {
      failedRef.current = false;
      setFailed(false);
    }
    const currentPositioner = positioner.current;
    const currentFrame = frame.current;
    const currentSurface = surface.current;
    const currentHandle = handle.current;
    const currentPanel = panel.current;
    const currentBody = body.current;
    if (
      !currentPositioner ||
      !currentFrame ||
      !currentSurface ||
      !currentHandle ||
      !currentPanel ||
      !currentBody
    )
      return;
    if (effectiveOpen) setPresent(true);
    try {
      if (!motion.current || (!motion.current.active && effectiveOpen)) {
        const view = currentFrame.ownerDocument.defaultView;
        if (!view) throw new Error('LabSheet: движение требует окно документа');
        const measure = (selector: string): number => {
          const element = currentPositioner.querySelector<HTMLElement>(selector);
          return element ? Number.parseFloat(view.getComputedStyle(element).height) : 0;
        };
        motion.current = mountSheetMotion(
          currentFrame,
          currentHandle,
          [
            currentHandle,
            currentPanel,
            currentBody,
            ...currentPositioner.querySelectorAll('.lab-sheet-preset'),
          ],
          {
            readGeometry: () => {
              const viewport = currentPositioner.getBoundingClientRect().height || view.innerHeight;
              const surfaceStyle = view.getComputedStyle(currentSurface);
              const gap = measure('.lab-sheet-gap');
              const bodyHeight = currentBody.getBoundingClientRect().height;
              const headingHeight =
                currentFrame.querySelector('.lab-sheet-panel-heading')?.getBoundingClientRect()
                  .height ?? 0;
              const natural = bodyHeight + headingHeight;
              const bodyGap = bodyHeight > 0 && headingHeight > 0 ? gap : 0;
              currentSurface.style.setProperty(
                '--_sheet-panel-gap',
                natural > 0 ? 'var(--_sheet-gap)' : '0px',
              );
              currentPanel.style.setProperty(
                '--_sheet-body-gap',
                bodyGap > 0 ? 'var(--_sheet-gap)' : '0px',
              );
              // Renderer измеряет содержимое и rem-пресеты; clamp и Half принадлежат Core.
              const flex =
                measure('.lab-sheet-handle') +
                Number.parseFloat(surfaceStyle.paddingBottom) +
                (natural > 0 ? gap + natural + bodyGap : 0);
              return sheetGeometry(viewport, measure('.lab-sheet-overlap'), {
                full: measure('.lab-sheet-preset-full'),
                'two-thirds': measure('.lab-sheet-preset-two-thirds'),
                'one-third': measure('.lab-sheet-preset-one-third'),
                flex,
              });
            },
            onPositionChange: changePosition,
            onOpenChange: changeOpen,
            onClosed: () => {
              if (!latest.current.effectiveOpen) setPresent(false);
            },
            onError: motionFailed,
          },
        );
      }
      if (!disposeMaterial.current) disposeMaterial.current = mountMaterialRuntime(currentFrame);
      motion.current.update(effectiveOpen, selectedPosition);
    } catch (error) {
      try {
        motion.current?.dispose();
      } catch {
        // Ошибка cleanup не заменяет первичный терминальный отказ Motion.
      }
      motionFailed(error);
    }
  });

  useClientLayoutEffect(
    () => () => {
      try {
        motion.current?.dispose();
      } finally {
        motion.current = undefined;
        try {
          disposeMaterial.current?.();
        } finally {
          disposeMaterial.current = undefined;
        }
      }
    },
    [],
  );

  const contentProps = api.getContentProps();
  const floating = (
    <DialogPortalPlane open={api.open}>
      {modal && <div {...api.getBackdropProps()} className="lab-sheet-backdrop" />}
      <div
        {...api.getPositionerProps()}
        ref={positioner}
        className="lab-sheet-positioner"
        hidden={!api.open}
        data-position={selectedPosition}
      >
        <div ref={frame} className="lab-sheet-frame" data-lab-sheet="">
          <div
            className="lab-sheet-ghost lab-material-ghost--sheet"
            data-veil="bottom"
            aria-hidden="true"
          />
          <div
            {...contentProps}
            className="lab-sheet-content"
            aria-labelledby={hasHeading ? contentProps['aria-labelledby'] : undefined}
            aria-describedby={hasDescription ? contentProps['aria-describedby'] : undefined}
          >
            <div ref={surface} className="lab-sheet-surface lab-material lab-material--sheet">
              <button
                ref={handle}
                className="lab-sheet-handle"
                type="button"
                aria-label="Изменить высоту панели"
              >
                <span className="lab-sheet-indicator" />
              </button>
              <div ref={panel} className="lab-sheet-panel-body">
                {(hasHeading || hasDescription) && (
                  <div className="lab-sheet-panel-heading">
                    {hasHeading && (
                      <h2 {...api.getTitleProps()} className="lab-sheet-heading">
                        {heading}
                      </h2>
                    )}
                    {hasDescription && (
                      <p {...api.getDescriptionProps()} className="lab-sheet-description">
                        {description}
                      </p>
                    )}
                  </div>
                )}
                <div ref={body} className="lab-sheet-body">
                  {content}
                </div>
              </div>
              {closable && (
                <button
                  {...api.getCloseTriggerProps()}
                  type="button"
                  className="lab-sheet-close"
                  aria-label="Закрыть"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="lab-sheet-preset lab-sheet-preset-full" aria-hidden="true" />
        <div className="lab-sheet-preset lab-sheet-preset-two-thirds" aria-hidden="true" />
        <div className="lab-sheet-preset lab-sheet-preset-one-third" aria-hidden="true" />
        <div className="lab-sheet-preset lab-sheet-overlap" aria-hidden="true" />
        <div className="lab-sheet-preset lab-sheet-gap" aria-hidden="true" />
      </div>
    </DialogPortalPlane>
  );

  return (
    <>
      <button ref={trigger} type="button" {...api.getTriggerProps()} className="lab-dialog-trigger">
        {children}
      </button>
      {mounted && createPortal(floating, document.body)}
    </>
  );
}
