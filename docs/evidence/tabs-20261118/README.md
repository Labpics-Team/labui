# Tabs — 18 November 2026

The unchanged [LabUI author library](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1) supplied Tab / Tinted, Tab / Underlined and tab-control. Private file identifiers stay outside this repository.

`comparison.png` compares the two source groups with Chromium and WebKit at 2×, displayed at use size. Source and rendered dimensions match: 778×56 Tinted and 778×48 Underlined. The medium alphabetic baseline is 18px within its 24px line. Remaining mean absolute RGB differences are 0.41–1.13 out of 255, mostly browser glyph rasterization and shadow sampling; these numbers supplement visual inspection.

The browser suite passed 76 checks across Chromium and WebKit. It covers controlled acceptance/refusal/null, ARIA, automatic/manual activation, disabled skip, Home/End, RTL, Tab/Shift+Tab exit, keyed-fragment reordering with edited React state, retained Lit panels, vertical centering, responsive layout, 100/125/200% and reduced Motion. The source geometry checks also require a real Shadow/XS, not equality between two missing shadows.

`render.generated.json` records both browsers, both themes, three font scales and Solid/Glass/Acrylic surroundings. The material frames use real Card material runtime and real Textarea editors; changing panels preserves the draft. `packed.json` records installed archives and an isolated consumer: four generated SSR adapters plus React, ESM declarations, no-JavaScript first paint, nullable selection, stable server ids, retained nodes and edits through hydration. The tab model is restored from server HTML without client-side assignment. The editor is LabUI Textarea, which handles React 18's dirty-textarea hydration behaviour.

Native source comparisons, 11 offscreen tests and the separately installed Maven consumer are in [the Compose evidence](../../../native/compose/evidence/tabs-20261118/README.md). Source Figma reads, browser tests and CPU Compose scenes created no visible windows or sound.

Reproduce from the workspace root, with Chromium/WebKit installed for Playwright:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '<playwright-browser-cache>'
$env:PW_PORT = '43581'
pnpm --filter @labpics/ui-docs exec playwright test tests/tabs.spec.ts --project=chromium --project=webkit --workers=4
node apps/docs/tests/tabs-render.mjs http://127.0.0.1:43581
node apps/docs/tests/tabs-packed.mjs
python docs/evidence/tabs-20261118/compare-source.py --tinted-source <export.png> --underlined-source <export.png>
```

Primary behavioural source: [ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) and [Zag Tabs](https://zagjs.com/components/tabs). Live screen readers and physical Android/iOS devices are outside these offscreen checks.
