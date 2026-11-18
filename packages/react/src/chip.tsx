'use client';

import type { LabChipMode, LabChipSize } from '@labpics/ui-core';
import { chipSelected } from '@labpics/ui-core/chip/contract';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import '@labpics/ui-core/chip.css';

export interface ChipProps {
  mode?: LabChipMode;
  size?: LabChipSize;
  sharp?: boolean;
  active?: boolean;
  selected?: boolean;
  defaultSelected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  showLeading?: boolean;
  leading?: ReactNode;
  name?: string;
  value?: string;
  form?: string;
  'aria-label'?: string;
  onSelectedChange?: (selected: boolean) => void;
  onAction?: () => void;
  onRemove?: () => void;
  children?: ReactNode;
}

export function Chip({
  mode = 'filter',
  size = 'm',
  sharp = false,
  active = false,
  selected,
  defaultSelected = false,
  disabled = false,
  loading = false,
  showLeading = false,
  leading,
  name,
  value = 'on',
  form,
  'aria-label': ariaLabel,
  onSelectedChange,
  onAction,
  onRemove,
  children,
}: ChipProps): ReactNode {
  const button = useRef<HTMLButtonElement>(null);
  const [localSelected, setLocalSelected] = useState(defaultSelected);
  const current = useRef({ selected, defaultSelected });
  current.current = { selected, defaultSelected };
  const effectiveSelected = chipSelected(mode, selected ?? localSelected);
  // The native form owns reset cancellation; reconcile after its default action.
  // biome-ignore lint/correctness/useExhaustiveDependencies: form changes the native association and must rebind reset.
  useEffect(() => {
    const native = button.current;
    const ownerForm = native?.form;
    const tasks = new Set<ReturnType<typeof setTimeout>>();
    const reset = (event: Event): void => {
      const task = setTimeout(() => {
        tasks.delete(task);
        if (
          !event.defaultPrevented &&
          native?.isConnected &&
          current.current.selected === undefined
        )
          setLocalSelected(current.current.defaultSelected);
      }, 0);
      tasks.add(task);
    };
    ownerForm?.addEventListener('reset', reset);
    return () => {
      ownerForm?.removeEventListener('reset', reset);
      for (const task of tasks) clearTimeout(task);
    };
  }, [form]);
  return (
    <>
      <button
        ref={button}
        type="button"
        form={form}
        disabled={disabled}
        data-lab-chip=""
        data-size={size}
        data-selected={effectiveSelected || undefined}
        data-sharp={sharp || undefined}
        data-active={active || undefined}
        data-loading={loading || undefined}
        data-leading={showLeading || undefined}
        aria-pressed={mode === 'filter' ? effectiveSelected : undefined}
        aria-busy={loading || undefined}
        aria-disabled={loading || disabled || undefined}
        aria-label={ariaLabel}
        onClick={(event) => {
          if (loading || disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (mode === 'filter') {
            const next = !effectiveSelected;
            if (selected === undefined) setLocalSelected(next);
            onSelectedChange?.(next);
          } else if (mode === 'remove') onRemove?.();
          else onAction?.();
        }}
      >
        <span className="lab-chip-leading" aria-hidden="true">
          {leading}
        </span>
        <span className="lab-chip-content">
          <span className="lab-chip-label">{children}</span>
          {effectiveSelected && <span className="lab-chip-close" aria-hidden="true" />}
        </span>
        <span className="lab-chip-glow" aria-hidden="true" />
      </button>
      {mode === 'filter' && name && (
        <input
          type="hidden"
          name={name}
          value={value}
          form={form}
          disabled={disabled || !effectiveSelected}
        />
      )}
    </>
  );
}
