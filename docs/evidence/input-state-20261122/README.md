# Input state and submission — 22 November 2026

Independent review of web `903c78e` and native `4a4d170b` found four web defects
and a native synchronization defect. This slice keeps the authored Input/Chip
profiles and fixes their actual form and editor behavior.

- Number Enter and blur share clamping. The accepted text is published before
  HTML submission and the commit callback. Direct `requestSubmit()` validates
  incomplete numbers, required and min/max. Lit shares Input's cancellable
  implicit-submit algorithm, including the real default submitter.
- Tags retain rejected additions/paste and renamed drafts through blur and
  keyboard return. Late acceptance advances the edit's accepted basis without
  consuming newer text. A source replacement cannot redirect a rename to another
  item. Focus requests carry their originating control and share one cancellable
  frame: stale pointer/keyboard actions cannot overwrite a later focus transfer.
- Combobox resolves accepted labels from the full source collection; filtering
  only affects navigation. Delayed values/items preserve a newer query. Blur and
  reset restore the accepted label; a cancelled reset preserves the query.
  Chip removal retains editor focus. At 200% text, the label wraps while its
  remove action stays beside it.
- Native Combobox synchronizes a replacement TextFieldState and single/multiple
  changes even when the accepted value is unchanged.

## Validation

Headless Chromium: 22 input-extension/state/submission tests and 61 existing
Input/Number/Tags/Pin tests passed. Headless WebKit: 82 passed, one existing
platform-specific skip. After the Chip wrap correction, the eight affected
state/render cases passed again in both engines. Four additional completed-paste
cases passed; these dispatch the browser's `insertFromPaste` input event without
writing to the user's system clipboard.

After the final selection/draft changes, 98 Chromium/WebKit checks passed across
the controlled extensions, Number submission, accepted Combobox state and existing
Tags behavior. An instrumented rapid-edit probe reproduced focus bouncing between
the main and item inputs; after cancelling superseded focus work, all 120 repeats
passed. Independent review reproduced and closed keyboard-return draft loss, then
found a later consumer focus transfer being stolen. Capturing focus at the event
boundary fixed that deferred-action race; the affected Tags and controlled suites
passed again: 62/62 Chromium/WebKit cases. Core, React and docs typechecks passed.
Final independent review closed the remaining focus transfer issue with ten
Lit/React checks, including opening an editor and immediately focusing another
control. No substantial findings remain in this reviewed input-state slice.

Native `InputExtensionsRenderTest`: 12/12, real ImageComposeScene/editor paths,
SOFTWARE and `java.awt.headless=true`. [XML](native-input-extensions.xml).
The prior Number/Chip/platform results cover their unchanged native source;
Android/iOS qualification of this input-family delivery remains pending.

The adjacent Light 100% and Dark 200% images were inspected from the real
Lit/React fixture. Neither Figma nor its fonts/profiles were modified.

Reproduce from the docs workspace against this worktree's own built packages:
`playwright test input-extensions-controlled.spec.ts number-input-submit.spec.ts combobox-accepted-state.spec.ts tags-input.spec.ts`.
Native: `gradlew :desktopTest --tests pics.lab.ui.InputExtensionsRenderTest` with
the headless environment above. This evidence does not claim merge or publication.

Sources: [HTML implicit submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission),
[constraint validation](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api),
[Spinbutton APG](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/),
[Zag Tags Input](https://zagjs.com/components/tags-input),
[Zag Combobox](https://zagjs.com/components/combobox),
the installed Zag 1.41.2 machine/connect sources, and the unchanged
[Lab UI source](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI).
