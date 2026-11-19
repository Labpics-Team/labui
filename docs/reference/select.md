# Select: selection state

`value` is an input: a supplied array controls the selection, including the empty
array. Both `element.value = ['a']` and `value='["a"]'` use the same contract. When
the user selects an option, `value-change` carries the requested values. The caller
accepts by assigning `value`; ignoring the event keeps the accepted selection.

Without `value` (`null` on the custom element), `defaultValue` initializes the
uncontrolled selection. Later changes to `defaultValue` do not replace a user's
choice. Read `selectedValues` for the accepted selection in either mode; the
uncontrolled component does not turn itself into a controlled one after a click.

```ts
select.value = ['studio'];
select.addEventListener('value-change', (event) => {
  select.value = (event as CustomEvent<{ value: string[] }>).detail.value;
});
```

The initial server frame resolves the selected labels from `items` and
`value ?? defaultValue`, including a controlled empty selection. It does not flash
the placeholder before the client starts the selection machine.

The generated Vue, Solid, Svelte and Astro APIs inherit the core property's type.
React uses the same Zag controlled-selection contract through `value` and
`onValueChange`.

Source: [Zag Select: controlled selection](https://zagjs.com/components/select#controlled-select-value).

This contract repair does not qualify the complete Figma Dropdown/Multiselect
design. Their shared profile, authored chips, native renderer and nested-overlay
behaviour remain separate implementation work.
