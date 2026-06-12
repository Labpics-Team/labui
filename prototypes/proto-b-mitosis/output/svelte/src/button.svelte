<script context="module" lang="ts">
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
   * (background), never an extra border (owner's separation principle).
   */

  export type LabButtonType = "accent" | "neutral" | "danger";

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
   * (background), never an extra border (owner's separation principle).
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
   * (background), never an extra border (owner's separation principle).
   */

  export type LabButtonSize = "s" | "m" | "l";

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
   * (background), never an extra border (owner's separation principle).
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
    onClick?: (event: MouseEvent) => void;
    // Children typed `unknown`: Mitosis exports no portable node type, so each
    // target widens it on compile (React -> React.ReactNode; see patch-output).
    children?: unknown;
  }
</script>

<script lang="ts">
  export let disabled: LabButtonProps["disabled"] = false;
  export let loading: LabButtonProps["loading"] = false;
  export let type: LabButtonProps["type"] = "accent";
  export let kind: LabButtonProps["kind"] = "fill";
  export let size: LabButtonProps["size"] = "m";
  export let onClick: LabButtonProps["onClick"];
  export let htmlType: LabButtonProps["htmlType"] = "button";
  export let ariaLabel: LabButtonProps["ariaLabel"];

  function handleClick(event: MouseEvent) {
    if (isInactive()) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }
  $: isInactive = () => {
    return Boolean(disabled) || Boolean(loading);
  };
  $: classNames = () => {
    return [
      "lab-btn",
      `lab-btn--type-${type}`,
      `lab-btn--kind-${kind}`,
      `lab-btn--size-${size}`,
      loading ? "lab-btn--loading" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
</script>

<button
  type={htmlType}
  class={classNames()}
  disabled={isInactive()}
  aria-busy={loading ? "true" : "false"}
  aria-label={ariaLabel}
  data-type={type}
  data-kind={kind}
  data-size={size}
  on:click={(event) => {
    handleClick(event);
  }}
>
  {#if loading}
    <span class="lab-btn__spinner" aria-hidden="true" />
  {/if}<span class="lab-btn__icon" aria-hidden="true" data-slot="icon" /><span
    class="lab-btn__label"><slot /></span
  ></button
>