# Tabs

`lab-tabs`, React `Tabs / Tab / TabPanel` and Compose `LabTabs` switch related views while retaining their panels. The shared `tabs` profile in `packages/tokens/src/components.json` records the unchanged LabUI author geometry. Web interaction uses one Zag group per Tabs; native uses the same controlled selection contract and logical navigation.

## Appearance

`variant` is `tinted` or `underlined`. Medium is authored: 12px control padding, 8px gap, Geist Medium 16/24 with the alphabetic baseline at 18px within the line, 20px adjacent icons and 24px icon-only controls. The authored exception is a 20px icon in horizontal Underlined with the bottom edge, making that control 44px tall. Other medium controls are 48px. Small and large are density extensions.

Tinted has a 16px track radius and 4px padding; the four-tab horizontal source uses 2px padding. Selected tabs use `control-bg` and Shadow/XS. Separators exist only between adjacent unselected tabs. Underlined uses a 1px `border-base` line, promoted to `border-strong` with Shadow/XS when selected. Group scrolling clips the shadow at its bounds, as the source group does. Focus is drawn inside the scrolling tablist to remain visible.

`orientation` controls the list axis. `edge` chooses the indicator's cross-axis edge: horizontal `start/end` means top/bottom; vertical `start/end` follows logical text direction and mirrors in RTL. It does not change Tinted. Horizontal tabs share available width equally while their labels fit, then scroll at natural minimum widths. Vertical panels wrap below the list when insufficient width remains. Panel identity survives that reflow.

## Selection and content

- Lit `value` and React `value` are controlled inputs. `undefined` enables uncontrolled selection from `defaultValue`; `null` deliberately selects no panel. A selection request never overwrites the controlled input. Lit `selectedValue` reads the current selection.
- Compose `value: String?` is controlled. Apply `onValueChange` to accept; retaining the old value refuses it. `null` selects no panel.
- Lit panels use slots named after item values. `icon` and `iconEnd` name separate decorative slots. React accepts direct `Tab` and `TabPanel` children, arrays and fragments. Icon-only controls keep their text label as their accessible name.
- Hidden panels stay mounted, but are hidden and inert on web and excluded from native semantics and focus entry. Plain React state, Compose `remember` and editor text survive switching, reordering and responsive reflow.
- Stable, unique item values identify both controls and panels. Removing an item ends that item's panel lifetime. Removing the selected item leaves no visible panel until the consumer chooses another value.

Automatic activation selects when a tab receives focus. Manual activation moves focus with arrows and waits for Enter, Space or click. Home and End move to the first and last enabled tabs; disabled tabs are skipped. A group with no selection still has one keyboard entry point. Explicit `dir` keeps server and client direction consistent.

## Rendering and effects

Server output includes roles, one tab stop, unique ARIA relationships and hidden non-selected panels before JavaScript. Lit hydration adopts the server identity even when the server has rendered earlier requests. Generated adapters preserve nullable controlled `value` as a property. The reflected JSON `items` attribute carries the tab model through HTML, so a generated Astro page can hydrate without assigning the data again in a client script. Malformed attribute data produces an empty tab list. Live frameworks can still update the `items` property.

Selection and visibility change immediately. `@labpics/motion` animates the selected decoration, stops an interrupted pose and honours reduced motion; it does not remount or fade the editor. Both appearances consume semantic roles within Solid, Glass or Acrylic surroundings without inventing a new material for the control.

Sources: [LabUI author library](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1), [Zag Tabs](https://zagjs.com/components/tabs), [ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
