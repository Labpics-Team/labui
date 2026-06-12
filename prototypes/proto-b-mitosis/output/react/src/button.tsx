"use client";
import * as React from "react";

/**
 * LabUI Button — the WRITE-ONCE Mitosis source.
 *
 * This single `.lite.tsx` file is compiled by the Mitosis CLI into native
 * React / Vue / Solid / Svelte components (see `output/`). It is NOT a React
 * component — it is the Mitosis JSX subset, and the constraints of that subset
 * are exactly what proto-B is built to measure (see FINDINGS.md).
 *
 * Axes (structural coverage of the Figma Button, NOT all 432 renders):
 *   Type:  accent | neutral | danger
 *   Kind:  fill | tinted | border | ghost
 *   Size:  s | m | l
 *   State: default | hover | pressed | loading | disabled | focus
 *   Slot:  leading icon (icon-slot), label children
 *
 * Theme-agnostic: every visual value is a `var(--lab-*)`. The component never
 * names a theme. Light/Dark are simulated by swapping the `--lab-*` set on an
 * ancestor (see theme/*.css). Surface separation is done by the surface token
 * (background), never an extra border (owner's separation principle). */ export type LabButtonType =
  "accent" | "neutral" | "danger";
/** * LabUI Button — the WRITE-ONCE Mitosis source. * * This single `.lite.tsx` file is compiled by the Mitosis CLI into native * React / Vue / Solid / Svelte components (see `output/`). It is NOT a React * component — it is the Mitosis JSX subset, and the constraints of that subset * are exactly what proto-B is built to measure (see FINDINGS.md). * * Axes (structural coverage of the Figma Button, NOT all 432 renders): *   Type:  accent | neutral | danger *   Kind:  fill | tinted | border | ghost *   Size:  s | m | l *   State: default | hover | pressed | loading | disabled | focus *   Slot:  leading icon (icon-slot), label children * * Theme-agnostic: every visual value is a `var(--lab-*)`. The component never * names a theme. Light/Dark are simulated by swapping the `--lab-*` set on an * ancestor (see theme/*.css). Surface separation is done by the surface token * (background), never an extra border (owner's separation principle).
 */

export type LabButtonKind = "fill" | "tinted" | "border" | "ghost";
/**
 * LabUI Button — the WRITE-ONCE Mitosis source.
 *
 * This single `.lite.tsx` file is compiled by the Mitosis CLI into native
 * React / Vue / Solid / Svelte components (see `output/`). It is NOT a React
 * component — it is the Mitosis JSX subset, and the constraints of that subset
 * are exactly what proto-B is built to measure (see FINDINGS.md).
 *
 * Axes (structural coverage of the Figma Button, NOT all 432 renders):
 *   Type:  accent | neutral | danger
 *   Kind:  fill | tinted | border | ghost
 *   Size:  s | m | l
 *   State: default | hover | pressed | loading | disabled | focus
 *   Slot:  leading icon (icon-slot), label children
 *
 * Theme-agnostic: every visual value is a `var(--lab-*)`. The component never
 * names a theme. Light/Dark are simulated by swapping the `--lab-*` set on an
 * ancestor (see theme/*.css). Surface separation is done by the surface token
 * (background), never an extra border (owner's separation principle). */ export type LabButtonSize =
  "s" | "m" | "l";
/** * LabUI Button — the WRITE-ONCE Mitosis source. * * This single `.lite.tsx` file is compiled by the Mitosis CLI into native * React / Vue / Solid / Svelte components (see `output/`). It is NOT a React * component — it is the Mitosis JSX subset, and the constraints of that subset * are exactly what proto-B is built to measure (see FINDINGS.md). * * Axes (structural coverage of the Figma Button, NOT all 432 renders): *   Type:  accent | neutral | danger *   Kind:  fill | tinted | border | ghost *   Size:  s | m | l *   State: default | hover | pressed | loading | disabled | focus *   Slot:  leading icon (icon-slot), label children * * Theme-agnostic: every visual value is a `var(--lab-*)`. The component never * names a theme. Light/Dark are simulated by swapping the `--lab-*` set on an * ancestor (see theme/*.css). Surface separation is done by the surface token * (background), never an extra border (owner's separation principle).
 */

export interface LabButtonProps {
  /** Semantic intent — drives which `--lab-*` role group the button reads. */
  type?: LabButtonType;
  /** Surface treatment within the chosen intent. */
  kind?: LabButtonKind;
  /** Control size — maps to spacing/typography tokens, never raw px. */
  size?: LabButtonSize;
  /** Async-busy state. Shows a spinner, blocks interaction, keeps width. */
  loading?: boolean;
  /** Hard-disabled. Non-interactive and removed from the tab order semantics. */
  disabled?: boolean;
  /** Native button type. */
  htmlType?: "button" | "submit" | "reset";
  /** Accessible label override (required when the button is icon-only). */
  ariaLabel?: string;
  /** Click handler. No-op while loading/disabled. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  // Children typed `unknown`: Mitosis exports no portable node type, so each
  // target widens it on compile (React -> React.ReactNode; see patch-output).
  children?: React.ReactNode;
}

function LabButton(props: LabButtonProps) {
  props = {
    type: "accent",
    kind: "fill",
    size: "m",
    loading: false,
    disabled: false,
    htmlType: "button",
    ...props,
  };
  const isInactive = function isInactive() {
    return Boolean(props.disabled) || Boolean(props.loading);
  };
  const classNames = function classNames() {
    return [
      "lab-btn",
      `lab-btn--type-${props.type}`,
      `lab-btn--kind-${props.kind}`,
      `lab-btn--size-${props.size}`,
      props.loading ? "lab-btn--loading" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  const handleClick = function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (isInactive()) {
      event.preventDefault();
      return;
    }
    props.onClick?.(event);
  };

  return (
    <button
      type={props.htmlType}
      className={classNames()}
      disabled={isInactive()}
      aria-busy={props.loading ? "true" : "false"}
      aria-label={props.ariaLabel}
      data-type={props.type}
      data-kind={props.kind}
      data-size={props.size}
      onClick={(event) => handleClick(event)}
    >
      {props.loading ? (
        <span className="lab-btn__spinner" aria-hidden="true" />
      ) : null}
      <span className="lab-btn__icon" aria-hidden="true" data-slot="icon" />
      <span className="lab-btn__label">{props.children}</span>
    </button>
  );
}

export default LabButton;
