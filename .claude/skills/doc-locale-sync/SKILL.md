---
name: doc-locale-sync
description: Update the translated Mangayomi docs after an English user page under docs/user/en/ or the root README.md changes.
---

# Doc Locale Sync

English pages are canonical; the rule for translations is in
[Documentation](../../../AGENTS.md#documentation).

1. Find the counterparts. `docs/user/translations.json` lists the English
   source pages and the locales; each locale has the same filename under
   `docs/user/<locale>/`. `README.md` maps to
   `docs/readme/README.<locale>.md`.
2. Translate every changed section from the English page into each locale.
   The interface is English only, so translated pages keep each UI label in
   English as it appears in `web/src/i18n/locales/en.json`, in bold, followed
   by a translated gloss in parentheses, as the existing pages do. Keep links,
   code, and identifiers unchanged, and check links to headings, whose anchors
   follow the localized heading text.
3. When a passage cannot be translated, remove the stale passage from that
   locale rather than leave it contradicting the English page.
4. Translations of different locales are independent; when the agent can
   delegate, one translation subagent per locale works well.
5. Run `make docs`. Its locale check confirms that every page exists in every
   locale, not that the content matches, so compare the changed sections
   yourself before handing off.
