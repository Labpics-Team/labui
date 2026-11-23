# File Upload

`FileUpload` (React), `<lab-file-upload>` (Web Components) and `LabFileUpload`
(Compose) select local files. The application sends the accepted files to its own
service. Selection never reads file contents, creates previews, or starts a network
request.

## Web

```tsx
import { FileUpload } from '@labpics/ui-react/file-upload';

<form encType="multipart/form-data">
  <FileUpload label="Attachments" name="attachments" view="dropzone"
    accept=".pdf,.txt" multiple maxFiles={5} maxFileSize={10 * 1024 * 1024}
    helper="PDF or text; up to 5 files, 10 MB each."
    onFileChange={({ acceptedFiles }) => console.log(acceptedFiles)} />
</form>
```

```html
<lab-file-upload label="Attachments" name="attachments" view="dropzone"
  accept=".pdf,.txt" multiple max-files="5" max-file-size="10485760">
</lab-file-upload>
```

Import `@labpics/ui-core/file-upload` to register the Web Component. Both renderers
use the same behavior and authored CSS. The `input` view is a compact field;
`dropzone` shows the illustrated area. Sizes `s`, `m`, `l` set compact field heights
to 40, 48 and 56 px. The area starts at the authored 381.2 px height and grows with
content; it does not force the source's 1200 px width.

`acceptedFiles` is controlled: a change callback requests a selection, and the
parent decides whether to accept it. Omitting it lets the component keep selection
from `defaultAcceptedFiles`. These are `File[]` properties, never serialized HTML
attributes. Lit uses `acceptedFiles = null` to return to uncontrolled operation.
In Lit, listen to `file-change` and `file-reject` CustomEvents; their `detail` has
the same shape as React's `onFileChange` and `onFileReject`.

Each selection, removal, clear or reset that changes either list emits one change
with the complete resulting `acceptedFiles` and `rejectedFiles` snapshot. Mixed
valid and invalid batches remain safe when a controlled parent applies the new
files on its next render. No-op actions emit no change. Status messages use live
regions that retain their renderer-managed children during native form reset.

Click the field, filename or Browse files button to open the real system picker.
The area also accepts dropped files. Remove clears a file. Cancelling the picker
keeps the accepted selection. A single-file field replaces its existing file;
multiple selection appends distinct files, including when `maxFiles` is one.
In multiple mode, duplicate files and a batch that exceeds `maxFiles` are rejected
without losing the accepted selection. Single mode accepts a replacement with the
same name, size and type, because its contents may differ. Directory drops produce
an explicit rejection; ordinary empty files remain valid. Errors are announced
and displayed by the field. `accept` follows native extension/MIME syntax; it is
client validation, and the receiving service must validate its own inputs.

`name` submits each accepted `File` under the same key in native `FormData`.
External forms use React's `form` prop or the Lit host's `form` attribute. Form
reset restores initial files in uncontrolled mode and retains controlled files.
Cancelled reset has no effect. Disabled fields, including disabled fieldsets, do
not submit or accept files. Read-only fields retain and submit the accepted files.
`required` validates an empty selection; `invalid` and `error` report application
validation. File access cannot be restored across page loads from a string.
Failed form validation displays an associated message and focuses the visible
picker button. It does not leave keyboard focus on the hidden native input.

The visible label can be shown with `labelHidden={false}` (React) or `element.labelHidden = false` (Lit).
`helper` and `error` associate with the control. Keyboard users reach real buttons;
the surrounding drop area is an accessible group. `translations` customizes picker,
empty, drop and remove accessible text without altering behavior.
Server rendering supports the empty field. Supply actual `File[]` values on the
client: they cannot cross the JSON hydration boundary or be recovered from HTML.

## Compose

`LabFileUpload(value, onValueChange, label)` uses FileKit 0.17.1 and returns
`PlatformFile` handles. Desktop and Android support file drops; iOS uses the system
picker. See the [Compose API and platform contracts](../../native/compose/docs/file-upload.md).

## Authored artwork

`assets/file-upload` contains the exact exported illustrations and file glyph.
`scripts/generate-file-upload-artwork.mjs` creates embedded web asset URLs and
copies PNG resources for Compose. Exports include shadow overflow; their intrinsic
size and measured offset are retained rather than fitted into the layout frame.
When available width shrinks, the layout frame retains its 2:1 aspect ratio;
bitmap overflow and the hover offset scale with that same frame.
The illustrations change for default, hover, dragging and selected states. The
empty disabled area omits the illustration, as authored.
PNG exports retain transparency (`contentsOnly: true`); the original export helper
flattened them against white. `drag-background.png` is the authored diagonal
stroke pattern. It is not a radial gradient. The shared profile retains measured
44.6 px vertical space: the source's centered 381.2 px frame overrides its declared
48 px padding. Long content grows naturally instead of reproducing clipped source
layout.

See [verification evidence](../evidence/file-upload-20261123/README.md).

Primary references: [Lab UI](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[Zag File Upload](https://zagjs.com/components/file-upload),
[FileKit](https://github.com/vinceglb/FileKit).
