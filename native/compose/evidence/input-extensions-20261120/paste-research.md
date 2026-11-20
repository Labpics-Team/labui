# Compose 1.12.2: actual Paste for LabTagsInput

Read-only investigation, 2026-11-20. Product worktree was not modified. Exact source artifacts were downloaded from Maven Central / Google Maven; Android implementation selected by org.jetbrains.compose 1.12.2 is androidx.compose 1.12.1.

## Decision

There is no common public callback around actual Foundation clipboard insertion. InputTransformation does not expose an input-source property. A clipboard-read marker is not an insertion receipt: Desktop reads data on Dispatchers.IO after getClipEntry returns; cancellation or intervening input can leave an unrelated edit carrying the marker.

Use one internal paste transaction operating on the existing TextFieldState. Decode plain text, validate the same writable/focused editor and request lifetime after suspension, replace selection and move cursor in state.edit, emit an explicit paste result only after that edit. Do not infer provenance from length, text delta, timers, or the next input transformation. Preserve ordinary IME/delimiter processing separately.

- Android: public Modifier.contentReceiver + ReceiveContentListener.onReceive, check TransferableContent.Source.Clipboard. Decode and consume synchronously. Return null only for content handled; return original for Drop/IME/unsupported content. A consumer may choose no-op consumption for a cancelled clipboard action. Source and consumption are public contracts.
- Desktop/iOS: a narrowly scoped Clipboard adapter is the available fallback for this pinned version: getClipEntry delegates one read, decodes, performs the transaction, then returns null so Foundation performs no duplicate edit. Forward nativeClipboard and setClipEntry. This deliberately depends on the verified state-based BasicTextField call-site invariant: its getClipEntry calls occur in paste/pasteAsPlainText only. Availability checks use native metadata. It is not a framework-guaranteed public Paste event. Keep the wrapper private, limited to this one editor, and test the invariant when Compose changes.

Do not use the consuming clipboard adapter on Android with an ancestor contentReceiver: Foundation paste first reads getClipEntry, then falls back to pasteAsPlainText on null, which reads again and can cause two insertions. The Android contentReceiver route avoids this counterexample.

## Public decoder APIs

- Desktop: @OptIn(ExperimentalComposeUiApi::class), ClipEntry.asAwtTransferable; check DataFlavor.stringFlavor; withContext(Dispatchers.IO) { transferable.getTransferData(DataFlavor.stringFlavor) as? String }. Catch unavailable-data exceptions IOException/UnsupportedFlavorException; do not swallow CancellationException. This mirrors Foundation's plain-text path.
- iOS: @OptIn(ExperimentalComposeUiApi::class), ClipEntry.getPlainText(), optional hasPlainText(). Member API, not extension.
- Android: ClipEntry.clipData; verify itemCount, use getItemAt(0).text?.toString() for Foundation plain-text parity. Avoid coerceToText because it would introduce URI/resource reads beyond current behavior. AndroidClipboard is a public @VisibleForTesting interface in ui-android 1.12.1; nativeClipboardManager explicitly requires that interface, so a Clipboard-only wrapper breaks metadata queries. No wrapper is needed with the recommended Android contentReceiver route.

## Undo experiment

Ran the isolated experiment with the real foundation-desktop 1.12.2 dependency, Kotlin 2.4.21, headless JVM. PASS: public decoder; replace selection; cursor at end of inserted text; first undo restores pre-paste text AND exact selection; second undo restores earlier edit; two redos restore paste. TextFieldState.commitEdit records programmatic edits with NeverMerge in this version. Existing advice that edit clears undo is obsolete for 1.12.2.

Command: native/compose/gradlew.bat -p D:/AgentWork/scratch/compose-paste-research-20261120/experiment run --console=plain --no-daemon

Output: BUILD SUCCESSFUL; PASS public desktop decoder; selected-range replacement; paste undo selection; earlier history; redo.

state.edit bypasses InputTransformation and syncs/notifies the IME. LabTagsInput owns its transaction semantics; if a general component later accepts caller transformations, that additional contract must be handled explicitly. Undo of tag-list acceptance remains a separate product contract; this proof covers the editor insertion.

## Negative results / exact source points

- contentReceiver constructs ReceiveContentDragAndDropNode; skiko actual throws NotImplementedError. It is not usable on Desktop/iOS 1.12.2.
- New TextContextMenuProvider exists, but isNewContextMenuInitiallyEnabled is false on Skiko and true on Android. Turning a global compatibility flag on inside a reusable field is not a local solution.
- Desktop public LocalTextContextMenu exposes command callbacks, but callbacks launch Foundation paste in a separate coroutine. A synchronous callback wrapper does not bracket insertion.
- iOS old native context menu uses internal LocalNativeTextInputContext, bypassing LocalTextToolbar. Toolbar interception alone misses native menu Paste.
- New Skiko TextContextMenuItemWithComposableLeadingIcon is internal; public builder.item can append replacements, but cannot simply wrap the existing item preserving all native details. More importantly, this path is disabled by default.
- Merely reading Clipboard is publicly documented as a read, not Paste. The Skiko adapter is a constrained integration fallback with explicit maintenance cost, not a universal public event.

## Checks required in product integration

Open context menu without selecting Paste; wrong MIME; empty clipboard; cancelled decoder; focus loss then regain; selection/draft edit while read is delayed; disposal; disabled/read-only change; successive/overlapping paste requests; IME/batched input after a failed read; paste over selected text; same-text replacement; actual paste undo/redo. Android nested/ancestor content receiver must not double-insert. iOS/Desktop native availability must keep the delegated native clipboard identity.

Source reading and one JVM experiment are complete. No Android/iOS device execution was performed in this investigation; platform event integration remains the author's validation responsibility.

## Primary sources read

- https://repo.maven.apache.org/maven2/org/jetbrains/compose/foundation/foundation-desktop/1.12.2/foundation-desktop-1.12.2-sources.jar
- https://repo.maven.apache.org/maven2/org/jetbrains/compose/foundation/foundation-iosarm64/1.12.2/foundation-iosarm64-1.12.2-sources.jar
- https://dl.google.com/dl/android/maven2/androidx/compose/foundation/foundation-android/1.12.1/foundation-android-1.12.1-sources.jar
- https://repo.maven.apache.org/maven2/org/jetbrains/compose/ui/ui-iosarm64/1.12.2/ui-iosarm64-1.12.2-sources.jar
- https://dl.google.com/dl/android/maven2/androidx/compose/ui/ui-android/1.12.1/ui-android-1.12.1-sources.jar
- https://developer.android.com/reference/kotlin/androidx/compose/ui/platform/Clipboard
- https://developer.android.com/reference/kotlin/androidx/compose/ui/platform/AndroidClipboard

Important files in extracted sources: commonMain/.../text/input/internal/selection/TextFieldSelectionState.kt:1571; commonMain/.../text/input/TextFieldState.kt:265; desktopMain/.../internal/ClipboardUtils.desktop.kt:42; iosMain/.../text/ContextMenu.ios.kt:131; skikoMain/.../ComposeFoundationFlags.skiko.kt:19; androidMain/.../text/input/internal/selection/TextFieldSelectionState.android.kt:121; iosMain/.../text/input/internal/selection/TextFieldSelectionState.ios.kt:346; desktopMain/.../text/input/internal/selection/TextFieldSelectionState.desktop.kt:95.
