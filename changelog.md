### DEV CHANGELOG


Version 1.1
- Ability to exclude a single website from script injection.

Version 1.5.0 - improvements (2025-11-13)
- Added session memory for the last save directory (`lastSaveDir`) so download handlers can suggest a path during the session.
- Added a "Reload all tabs" button: reloads all open HTTP(S) tabs while skipping blacklisted origins.
- Implemented per-site blacklist: you can exclude a site's origin so the extension will not inject scripts or perform downloads on that origin.
- Popup UI: shows the current site (displaying `example.com` without `http(s)://` or leading `www.`) and a button `Exclude this site` / `Remove exclusion` to add/remove the origin from the blacklist.
- Context menu updates: menu items `Download MP4` and `Find & download MP4 on page` are disabled (grayed-out) when the active tab's origin is blacklisted; the popup now reloads the current tab automatically when adding/removing an exclusion.
- Download behavior: context-menu download now prompts the Save As dialog (uses `saveAs: true`) and falls back to searching the page for an MP4 URL if no src/link is present.
- Notifications: shows a brief notification when the user attempts a download on an excluded site.
- Injection behavior: `unlock-right-click.js` and CSS are injected only on non-blacklisted origins and only when the extension is enabled.
- Various UX fixes: made the reload button independent from the global enable toggle, adjusted popup styling and labels, and improved logging for easier debugging.

Notes:
- The blacklist is persisted in `chrome.storage.local.blacklist` and mirrored in-memory in the background service worker.
- `lastSaveDir` is stored in memory for the session only (not persisted across browser restarts).

