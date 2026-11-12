## Added

- **Settings → Appearance → Loading long lists** switches the library, series,
  and author lists between infinite scroll and pages. Pages keep the page
  number in the address, so going back returns to the same page.

## Changed

- Infinite-scroll lists skip rendering for cards outside the viewport and keep
  at most five pages cached after you leave them, which reduces work and
  refetching on large libraries.

## Security

- The server builds with Go 1.27.4, which carries the standard library fix
  for an HTTP/1 server crash in `net/http`
  ([GO-2026-6859](https://pkg.go.dev/vuln/GO-2026-6859)).
