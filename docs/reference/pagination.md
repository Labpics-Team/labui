# Pagination

`Pagination` / `<lab-pagination>` / `LabPagination` navigate a finite collection.
The consumer changes the displayed data on a page request. Web consumers can
instead pass `href="?page={page}"` to use native destinations, including browser
history and modified clicks. `{pageSize}` is also available in the template.

`count` is the number of records, `pageSize` the records per page. Pages start at
1. An empty collection has no page items and both directions are disabled.
Invalid counts become 0, invalid page sizes become 10, and the displayed page is
clamped to the current bounds. Changes to these inputs do not emit navigation
requests. A controlled consumer should keep its dataset and page valid together.

Web `page` is optional. Setting it as a property or attribute selects controlled
mode: `page-change` carries `{page, pageSize}` and React `onPageChange` receives
the page number, while selection waits for the consumer's updated input. Without
`page`, `defaultPage` seeds local state once. `selectedPage` on the element reads
the current display; `page` remains the controlled input. Compose is controlled.

The source has one numbered control profile: a 40 px minimum, 12 px radius,
8 px gaps and Geist Medium 16/24. Its horizontal sizing is Hug with 12 px
padding; longer page numbers can widen the control. The former ungrounded
`s/m/l` density axis has been removed.
Geometry uses rem on web and scales with the system font scale in Compose;
rows wrap when they no longer fit. `siblingCount` controls the numbered window,
bounded to 0–4, and does not describe a Figma design axis. Window work stays
bounded as the dataset grows. First/last boundaries remain reachable.

`variant="compact"` displays up to five 8 px dots in a 24 px strip. Smaller
6 px edge dots indicate continuation beyond the visible window. `ambient`
adds the shared Base material and neutral dots. Otherwise dots use the brand
label role. `progress` (0–1) replaces the selected dot with a 20 px track. The
application supplies its media clock and owns play/pause; the component starts
no timers and makes no automatic page requests.

Numbered controls and compact links use native Tab and activation semantics.
Compact buttons have one Tab stop and support Left/Right, Home and End;
direction follows RTL. Rejected requests keep the consumer's selected page and
focus. When a controlled page is accepted later, a focused Compact control
follows the accepted page. If the user has already left navigation, neither
that acceptance nor a progress update moves focus back. Lit, React and Compose
check focus at the committed page change, without retaining a pending focus
request. Ellipses are decorative, not undisclosed actions. `disabled` removes
navigation destinations and prevents requests. The name and previous/next/page
labels are localizable; the page label supports `{page}`.

`packages/tokens/src/components.json#pagination` is the common authored profile.
Lit and React share one CSS sheet. Native constants and contours are generated
from the same profile. Web range behavior uses the existing
[Zag Pagination machine](https://zagjs.com/components/pagination); server render
uses its never-started service, so there is no second web range algorithm.
Reflected inputs retain the same controlled state through generated
Vue/Solid/Svelte/Astro SSR and Lit hydration.
React's small navigation wrapper uses
[`getSnapshotBeforeUpdate`](https://react.dev/reference/react/Component#getsnapshotbeforeupdate)
to read actual focus immediately before page-window DOM replacement.

Source: [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
Pagination / Page-button / Chevron-button / Compact Pagination.
See [render and package evidence](../evidence/pagination-20261119/README.md).
