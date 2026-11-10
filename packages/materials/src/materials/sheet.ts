import { SHEET_SOLID } from '../profiles/sheet';

/** Build-time CSS projection. The shared profile owns Sheet's Solid role. */
export const sheetCss = `
.lab-material--sheet {
  --_base: var(${SHEET_SOLID});
  --_tint: color-mix(
    in srgb,
    transparent,
    var(--lab-bg-material-base-01) calc(var(--_material-active, 0) * 100%)
  );
  --_sheet-theme: var(--_lab-light, light) var(--_lab-dark, dark);
}

/* The ordered filter already owns the paints; only the border is overlaid. */
.lab-material--sheet-ordered::before {
  background: var(--lab-border-base);
}
`;
