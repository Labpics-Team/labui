# Independent Tooltip review

An independent reviewer started without the author's discussion history at freeze `6594924b`, using the immutable Figma snapshot, code and actual browser/Compose evidence. The following findings were corrected and rechecked:

| Finding | Resolution and observed check |
| --- | --- |
| Native HTML button's description proxy was excluded from the composed tree by a missing slot | Proxy now lives in the actual root. Chromium AX tree returns the description; DOM-only accessible-name assertions were insufficient |
| The same Lit element stopped working after remove/append | Reconnection requests an update and binds the current actual control; Chromium/WebKit hover and keyboard focus pass |
| Nested named-slot text left the cloned description stale | Only-open observation of exact content nodes; AX/DOM descriptions change Before → After and proxy is removed on disconnect |
| Horizontal native tail space used logical padding for physical sides | Physical padding; actual LTR/RTL popup bounds agree |
| SSR helpers were described as real framework consumers | Separate installed Vue/Solid/Svelte SSR/hydration and real Astro build pass in both browsers; coverage is explicit in the README |
| A stale global store close could dismiss a newly focused Tooltip | The derived close transition checks the current identity at processing time. Ordinary Tab/Shift+Tab and `b.focus(); queueMicrotask(() => a.focus())` pass in Chromium/WebKit; competing hover keeps at most one visible surface |
| Horizontal native tail rotation displaced the tail by its carrier width | Corrected translation signs; eight actual LTR/RTL × Left/Right × Chevron/Bubble images inspected. Tail center differs from control center by Chevron ±0.5 px, Bubble 0 px |

The reviewer accepted source corrections `6201e20a`, `0f6b9c67` and `6dc18043` after these checks. Native Escape outside the focused trigger branch follows Foundation/Material3; this is stated in the component reference rather than presented as a global keyboard shortcut. Final installed artifacts and their limits are recorded in `packed.json`, `packed-react19.json`, `frameworks.json` and `native.json`.
