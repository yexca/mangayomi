# Design

Mangayomi should feel like a quiet, modern bookshelf: covers first, chrome
second.

## Design Principles

- Covers carry the interface. Text is secondary and short.
- The reader belongs to the pages. Controls appear on demand and disappear on
  the next page turn.
- Mobile is not a reduced desktop. Navigation moves to a bottom bar, grids
  reflow to two columns, and every action is reachable with a thumb.
- Destructive actions are deliberate. They are visually distinct, never the
  default button, and always show what will happen before it happens.
- Calm by default. Background work (scans) is visible but does not block.

## Visual Direction

- shadcn/ui "Nova" style with the neutral palette and Geist Variable.
- Light, dark, and system themes. The reader is always black.
- Surfaces: `background -> card -> popover or dialog`. Use borders and subtle
  rings for structure; reserve shadows for floating elements.
- Radius comes from the `--radius` token; do not hard-code corner sizes.

## Layout

- Desktop: a fixed 14 rem sidebar with Home, Library, Series, Authors, and
  Settings, and content up to `max-w-7xl`.
- Mobile: a bottom navigation bar with the same five destinations, respecting
  safe-area insets.
- Cards: covers at a 2:3 aspect ratio, two-line clamped titles, one-line
  subtitle. Groups (series, authors) show a stacked-cover hint and a count.
- Multi-select shows checkmarks on cards and a floating action bar with the
  selection count, select all, mark read/unread, and delete.

## Reader

- Full-screen black stage. Top bar: back, title, author and series,
  fullscreen, settings. Bottom bar: page indicator, previous/next work, and a
  slider that runs right to left in RTL mode.
- Tap zones: outer 30% on each side turn pages, the center toggles controls.
- Settings open in a bottom sheet: direction, layout, fit, cover alone.

## States

- Loading: skeleton cards in grids, a spinner on the reader stage.
- Empty: a dashed panel with an icon, one sentence, and at most one action.
- Errors: a toast for failed actions; a full-page message with retry only when
  rendering itself fails.

## Copy

- Sentence case for labels and buttons.
- Say what an action does to files: "Delete permanently", "Remove library"
  (with "Files on disk are not touched").
