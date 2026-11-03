## Added

- **Settings → Appearance → Loading long lists** switches the library, series,
  and author lists between infinite scroll and pages. Pages keep the page
  number in the address, so going back returns to the same page.

## Changed

- Infinite-scroll lists skip rendering for cards outside the viewport and keep
  at most five pages cached after you leave them, which reduces work and
  refetching on large libraries.
