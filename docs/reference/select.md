# Select: Dropdown and Multiselect

One family selects values from `items: { value, label, disabled? }[]`. Values are
unique stable keys; labels may change without losing selection. Dropdown uses
32/48/56 px sizes (`s`, `m`, `l`). `multiple` uses the authored 48 px Multiselect
composition and removable 28 px sharp Chips. It grows when chips wrap. Metrics and
the chevron come from `components.json#select`; Lit and React share one stylesheet,
Compose consumes generated metrics and the existing Chip.

`label` names the control. Dropdown keeps that name visually hidden, matching the
source composition. A visible form label can be composed externally. Multiselect
shows its internal floating caption by default, matching Figma's `Show label=True`.
`showLabel=false` (HTML `show-label="false"`) hides only that caption; its accessible
name remains. `leading` is a decorative Dropdown slot (a React node or Compose
icon scope), with authored 16/16/20 px size. No arbitrary icon is inserted by default.

Each chip is a separate removal button beside the trigger. Its accessible name is
`removeLabel + label` (`Remove` by default); localize that verb for the product.
Removing a chip requests a value change and returns focus to the trigger. There
are no buttons nested inside the combobox trigger and no second chips state.

## Accepted selection

`value` is an input: an array, including `[]`, controls the selection. Both
`element.value = ['a']` and `value='["a"]'` use the same contract. `value-change`
requests a new array; assigning `value` accepts it. Ignoring or delaying that
assignment preserves the displayed chips, native selection and submitted value.
The empty-string key `''` is a value, distinct from an empty array.

Without `value` (`null` on the custom element), `defaultValue` initializes the
uncontrolled selection. Later defaults do not replace a user's current choice.
Read `selectedValues` for the accepted selection in either mode. Reordering or
removing `items` does not rewrite accepted values. A missing item retains a chip
using its key as fallback text; restoring that item restores its label.

```ts
select.value = ['studio'];
select.addEventListener('value-change', (event) => {
  select.value = (event as CustomEvent<{ value: string[] }>).detail.value;
});
```

React uses `value`/`onValueChange`, with `undefined` for uncontrolled mode.
Vue, Solid, Svelte and Astro inherit the core property's contract. Compose exposes
`LabSelect(value: List<String>, onValueChange, items, label, multiple, ...)`: the
caller accepts requests and resets by assigning the value. Local Compose state
can use `rememberSaveable { mutableStateOf(defaultValues) }`.

## Forms and initial rendering

Lit is form-associated: `ElementInternals` submits the accepted enabled options
through `FormData`. The hidden shadow `<select>` supplies native validity and
autofill semantics; its `name` alone does not provide the external form association.
React's native `<select>` participates directly in its form. Multiple values
produce repeated entries with the same `name`. Missing and disabled options are
omitted from submission, as in a native select, while the accepted array survives.

`required`, `disabled` and native `input`/`change` are supported. Native input
reads `selectedOptions`, preserving a real empty-string option (`['']`) as
distinct from no selection (`[]`).

Every disabled ancestor `fieldset` disables the control, except when the control
is inside that fieldset's first `legend`. The exception applies separately to
each ancestor; an outer disabled fieldset can still disable the control.

A non-cancelled reset restores the initial uncontrolled default and preserves
controlled values. Calling `preventDefault()` on the form's `reset` event
preserves the accepted selection, visible chips and submitted values. Changing
React's `form` prop updates the native form association: reset follows the
currently associated form, and resetting the previous form has no effect.

Lit also exposes `form`, `validity`, `validationMessage`, `checkValidity()` and
`reportValidity()`, and restores saved state only in uncontrolled mode.

The server frame resolves labels and chips from `value ?? defaultValue`, including
a controlled empty array. The positioned listbox is interactive after connection;
its keyboard navigation, typeahead, RTL and dismissal use Zag on web. Compose
uses Foundation actions and a native popup, with arrows, Home/End and Escape.

Sources: [Figma Dropdown](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6212-445),
[Multiselect](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6214-4162),
[Zag Select](https://zagjs.com/components/select#controlled-select-value),
[form-associated custom elements](https://web.dev/articles/more-capable-form-controls),
[HTML selected options](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/selectedOptions),
[current form association](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/form),
[form reset](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event).
