# Frontend

The frontend lives in `web/`: React 19, TypeScript, Vite, Tailwind CSS 4,
shadcn/ui components on Radix primitives, TanStack Query, React Router,
react-i18next, and `vite-plugin-pwa`. The production build is written to
`web/dist` and served by the Go server.

## Layout

| Path | Contents |
| --- | --- |
| `src/App.tsx` | Providers, the auth gate, and routes. |
| `src/pages/` | One file per screen: home, browse, series, authors, work, reader, settings, login. |
| `src/components/` | App components (cards, grids, dialogs such as the library form, app shell). |
| `src/components/ui/` | Generated shadcn/ui primitives. |
| `src/shadcn.css` | Theme variants and keyframes the shadcn/ui primitives expect. |
| `src/hooks/` | Selection, reader preferences, scan status polling, library filter. |
| `src/lib/` | API client and types, formatting, links, spreads, storage helpers. |
| `src/i18n/` | i18next setup and `locales/en.json`. |

## Routes

| Path | Screen |
| --- | --- |
| `/` | Home: continue reading and recently added |
| `/library` | All works with search, status, sort, and multi-select |
| `/series`, `/series/view?author=&series=` | Series list and detail |
| `/authors`, `/authors/view?author=` | Author list and detail |
| `/works/:id` | Work detail |
| `/read/:id?page=` | Reader (full screen, outside the app shell) |
| `/settings` | Settings; libraries are added and edited in a dialog |

Series and author names travel in query strings because they may contain `/`.

## Data Fetching

- TanStack Query owns server state. Mutations invalidate affected queries
  rather than patching caches.
- The library, series, and author lists load 60 items at a time and fetch
  the next page as the end of the grid nears the viewport (`LoadMore`).
- A `401` from any API call invalidates the `auth` query, which returns the
  app to the sign-in screen.
- Scan status is polled every 1.5 seconds only while a scan runs; when it
  finishes, library queries are refreshed.
- The library filter and reader preferences are stored in `localStorage`
  through helpers that tolerate unavailable storage.

## Reader

- Pages are grouped into spreads by `lib/spreads.ts`: in double mode, pages are
  paired except wide pages (already a spread), and optionally the first page
  stands alone. The current page index, not the spread index, is the state, so
  changing the layout keeps the position.
- Tap zones are the outer 30% on each side. In right-to-left mode the left
  zone, a rightward swipe, and the left arrow key all advance.
- Progress is saved 600 ms after the page settles, when the page is hidden,
  and when the reader closes. A work is completed when its last page is shown.
- The next two spreads and the previous one are preloaded.

## PWA

The service worker precaches the app shell and caches covers (3,000 entries,
30 days) and pages (300 entries, 7 days) with a cache-first strategy. API
requests other than images are never cached. Navigation falls back to
`index.html` except for `/api/` paths. The worker updates automatically on the
next visit after a deployment.

## Related Docs

- [Design](../development/design.md)
- [Frontend guidelines](../development/frontend-guidelines.md)
