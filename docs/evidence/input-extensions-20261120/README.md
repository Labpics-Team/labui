# Input extensions — web, 20 November 2026

Combobox, Number Input and Tags Input compose the existing Input profile; Combobox uses Dropdown rows and disclosure, Tags Input uses Chip S Sharp. They have no separate Figma masters. This change does not alter the design file or claim native coverage.

The three renderers share `input-extensions.css`, semantic colors, a transparent notched outline and relative dimensions. Lit fields participate in native forms through ElementInternals; React submits accepted values through ordinary form controls. Controlled values remain with the application, including rejected updates and cancelled resets.

## Verification

- Core typecheck and build, React build, docs typecheck and Vite production build passed.
- 110 core tests passed, including SSR and behavior contracts.
- 120 Chromium/WebKit tests passed for the three fields and their shared fixture. A later installed-package run exposed delayed Combobox focus restoration; a deterministic regression reproduced it before correction.
- After that correction, 196 Chromium/WebKit tests passed: input extensions, Combobox, Select and Tabs. The latter two exercise the shared ZagController cleanup change. Number Input and Tags Input implementation was unchanged after their successful full suites.
- Catalog generation and checking passed against the clean native source tree matching this web branch's base. Native extensions are developed separately and are not in this projection.
- `input-extensions-packed.mjs` installed 12 archives into an isolated consumer. TypeScript NodeNext, React CommonJS imports, server rendering through five public package APIs, and all 10 framework × browser hydration/form/keyboard/reset scenarios passed. Archive hashes are in `packed.json`.
- Screenshots cover light/dark, 1100px at the default font size, and 390px with a 32px root font (200% text scaling), with loaded Geist and no horizontal document overflow. The reset links are fixture controls. No screenshot represents a new Figma design.

The focused tests cover cancelled native reset, controlled rejection, replaced filtered collections, disabled options and fieldsets, native popover outside transformed clipping, IME Enter and numeric composition, rapid Escape, preserved text selection and focus in the next field. A 1000-update run verifies that Lit retains cleanup only for live nodes and releases it on disconnect.

All browser runs were headless. The exact Icons 0.4.0 CI archive was supplied through `LAB_ICONS_TARBALL`; its hash is recorded in `packed.json`. No local archive override is committed.

## Reproduce

Build core, React and the four generated adapters. Run:

```sh
pnpm --filter @labpics/ui-core test
pnpm --filter @labpics/adapter-codegen test
pnpm --filter @labpics/ui-docs exec playwright test input-extensions.spec.ts combobox.spec.ts number-input.spec.ts tags-input.spec.ts select.spec.ts tabs.spec.ts
node apps/docs/tests/input-extensions-packed.mjs
```

The packed test uses the installed Playwright browsers and requires all dependency versions in the local pnpm store for its offline install. Until Icons 0.4.0 is published, set `LAB_ICONS_TARBALL` to its exact CI archive.

Primary references: [Combobox APG](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [Spinbutton APG](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/), [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using). Focus, reset and IME integration was also checked against the installed Zag 1.41.2 behavior and Vanilla 1.48.0 normalization/spread implementation.
