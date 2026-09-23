# Overview

Mangayomi is a self-hosted manga library and reader for a NAS. It indexes the
archives and image folders already on disk and serves them to a web reader that
works on desktop and installs as a PWA on mobile.

## Goals

- Read a personal manga collection from any device on the home network.
- Respect the existing folder layout instead of importing or renaming files.
- Derive useful structure (authors, series) from folder names with a simple,
  previewable pattern.
- Make destructive actions explicit, reviewable, and bounded.
- Stay small: one container, one SQLite file, no external services.

## Current Status

Mangayomi currently includes:

- Docker image with a Go server that serves both the API and the built web app.
- SQLite-backed libraries, works, reading progress, and sessions.
- Library management with folder picker, excluded folders, folder patterns,
  preview, and manual or scheduled incremental scans.
- `.zip`/`.cbz` archives and image folders as works; JPEG, PNG, GIF, WebP, BMP,
  and AVIF pages (AVIF pages have no cover thumbnail).
- Home, library, series, author, and work pages with search, filters, and
  multi-select.
- A reader with right-to-left and left-to-right reading, single, double, and
  automatic layouts, spread detection, tap/swipe/keyboard navigation, and
  progress sync.
- Two-step deletion of works, selections, series, and authors.
- Single-user password authentication.
- English UI with an i18n structure ready for more languages.

## Current Limits

- One user. There are no accounts, roles, or per-user progress.
- Only zip-based archives. RAR, 7z, and PDF are not supported.
- Metadata comes only from folder and file names; `ComicInfo.xml` is not read.
- No pinch-zoom controls beyond the browser's own zoom.
- One instance per database; SQLite is not shared between processes.
