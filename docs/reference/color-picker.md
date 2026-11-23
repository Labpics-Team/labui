# ColorPicker

`@labpics/ui-core/color-picker` registers `<lab-color-picker>`; React uses `ColorPicker` from `@labpics/ui-react/color-picker`. Vue, Solid, Svelte and Astro adapters are generated from the same declared properties and events. [Native API](color-picker-native.md).

```ts
const value = {
  space: 'hsv' as const,
  coords: [35.123456789, 83.987654321, 91.123456789] as const,
  alpha: 0.5019607843137255,
};
```

The accepted value is a structured `LabColorValue`: three finite coordinates and alpha in 0..1. sRGB coordinates use 0..1; HSL/HSV hue is degrees and the other coordinates are percentages. LCH is CSS CIELCH D50, never OKLCH or CIELCH D65. Out-of-gamut coordinates remain representable. `value: undefined` is uncontrolled; `null` is empty. Reset restores the initial uncontrolled `defaultValue`; a controlled consumer remains responsible for accepting requests.

`model` and `variant` are independently controlled display choices. `defaultModel` and `defaultVariant` set the initial uncontrolled display. Changing either choice, gamut visibility or graph visibility never changes the accepted raw value. Display text and RGB8/HEX output may round; form serialization uses full Number precision. Focus exposes full-precision editing text; partial LCH edits retain untouched coordinates and alpha. Focus and blur without editing do not commit rounded text. Explicit alpha in CSS functions, alpha HEX and structured JSON is honored. `parseColor`, `serializeColor`, `colorCss` and `colorHex` are the public conversion boundary.

Grid uses the exact authored Figma sRGB samples: a 12-by-10 matrix of 120 colors for HEX/HSB/HSL/RGB, and a separate 10-by-10 matrix of 100 colors for LCH. HEX channel fields accept base-16 byte values such as FF and 95. Spectrum edits HSV saturation/value; LCH Spectrum shows two planes. LCH Sliders associate the Lightness row with fixed H (L×C), Chroma with fixed L (H×C), and Hue with fixed C (H×L). Axes, pointer mapping, markers and tracks share a chroma domain of 145, or 195 with Rec.2020. These are view bounds from the established reference, not clamps on stored values. Transparent regions mark colors outside all enabled gamuts; clipping paint never rewrites the selected color.

Track paint, marker and pointer mapping share one inset span. Grabbing a marker retains the starting value and pointer offset; graph picking uses its full pixel domain. Native ranges provide keyboard and assistive input; each plane exposes separate named axis sliders. A pointer cancellation or Escape requests the start value back and does not emit completion. `value-change-end` reports only an accepted change. IME composition remains a draft until committed. `name`, `form`, `required`, disabled fieldsets and native reset follow form semantics. Form values are JSON, not the rounded display string.

The eyedropper uses the browser's public `EyeDropper` API, or an explicit `pickScreenColor(signal: AbortSignal)` callback. Manual edits, reset, external values, disable, read-only and detach cancel the operation; stale or null results emit no completion. It is unavailable without a real pixel-picking capability. A generic OS color dialog is not a substitute for a screen eyedropper. Clipboard uses the platform clipboard; close requests are handled by the containing dialog/application.

Conversions are isolated behind Color.js0.7.1. LCH graph drawing uses `@colordx/gpu`1.0.0 when WebGL2 is available, with a cancellable CPU fallback using the same projection contract. Graphs cache by fixed coordinate, size and gamut settings; alpha and marker-only changes do not redraw them. UI code contains no perceptual solver or palette generator.

Sources: [immutable Figma](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6387-45035), [CSS Color4](https://www.w3.org/TR/css-color-4/), [Color.js](https://colorjs.io/), [reference range behavior](https://github.com/evilmartians/oklch-picker/blob/main/view/range/index.ts), [reference domains](https://github.com/evilmartians/oklch-picker/blob/main/config.ts). Authored illustration inconsistencies are recorded in the evidence directory; the source is unchanged.
