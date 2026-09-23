# Reading

[English](reader.md) · [简体中文](../zh-Hans/reader.md) · [繁體中文](../zh-Hant/reader.md) · [日本語](../ja/reader.md) · [한국어](../ko/reader.md)

Open a work and choose **Read**, **Continue · page N**, or **Read again**. The
reader opens full screen on a black background and resumes where you stopped.
**Start over** opens a work in progress from the first page.

## Turning Pages

| Action | Right to left | Left to right |
| --- | --- | --- |
| Tap the left 30% of the screen | Next | Previous |
| Tap the right 30% of the screen | Previous | Next |
| Swipe right | Next | Previous |
| Swipe left | Previous | Next |
| `←` / `→` keys | Next / Previous | Previous / Next |
| `Space` or `Page Down` | Next | Next |
| `Page Up` | Previous | Previous |

Tap the middle of the screen to show or hide the controls. `Esc` or the back
button leaves the reader. Swipes are ignored while the page is zoomed with two
fingers, so you can pan.

## Controls

- **Top bar:** back, title, author and series, fullscreen (where supported),
  and reader settings.
- **Bottom bar:** the current page or pair of pages, a slider to jump to any
  page, and buttons for the previous and next work in the series. In
  right-to-left mode the slider and the work buttons are mirrored.

After the last page, a finished screen offers the next work in the series,
the work details, or starting over.

## Reader Settings

Open the settings button in the top bar:

- **Reading direction:** **Right to left** or **Left to right**. Saved for the
  current series (or the work, if it has no series) in this browser; other
  series keep the library default.
- **Page layout:**
  - **Single:** one page at a time.
  - **Double:** two pages side by side, ordered by the reading direction.
  - **Auto:** double on landscape screens at least 768 px wide, single
    otherwise.
- **Fit:** **Whole page** fits the page to the screen; **Width** fills the
  width and scrolls vertically.
- **Show first page alone:** in double layout, keeps the cover on its own so
  the following pages pair up correctly.

Pages wider than they are tall are treated as spreads and always shown alone.

Layout, fit, and the cover option are global for the browser and can also be
set under **Settings → Reader defaults**.

## Progress

The current page is saved shortly after it settles, when the app is sent to the
background, and when you leave the reader. A work is marked completed when its
last page is shown. Progress is stored on the server, so other devices continue
from the same page.

## Offline Behavior

The installed app caches recently read pages (the last 300) and covers, so a
work you were reading keeps loading if the connection drops briefly. It is not
a full offline download feature.
