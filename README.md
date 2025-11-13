# Advanced MP4 Finder

Quickly unlock right-click, find MP4s on any page, and download them with a single click.

Lightweight Chrome extension to recover downloadable MP4s from web pages and make downloads straightforward. It includes per-site exclusions, a one-click "Reload all tabs" function, and always prompts the browser Save As dialog for downloads.

Key features
- Unlocks right-click and injects helper CSS/JS to enable selecting and saving media on pages.
- Finds MP4 URLs on the current page and offers a direct download option.
- Context menu items: "Download MP4" and "Find & download MP4 on page".
- Per-site blacklist: exclude sites where you don't want the extension to run (managed from the popup).
- "Reload all tabs" button: reload all open HTTP(S) tabs while skipping blacklisted origins.
- Downloads prompt the browser's Save As dialog (so you choose location each time).

Quick start (developer mode)
1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this repository folder (`AdvancedMp4Downloader` / `AdvancedMp4Finder`).
4. The extension popup contains the global toggle, current site display, and the "Exclude this site" button.

How to use
- Open a page with a video or a link to an MP4.
- Right-click the video or link and choose **Download MP4**, or open the popup and click **Find & download MP4 on page**.
- To prevent the extension from running on a site, open the popup on that site and click **Exclude this site** — the page reloads and downloads/injections are disabled for that origin.

Privacy & permissions
- This extension stores a local `blacklist` and a session-only `lastSaveDir` in `chrome.storage.local`. No user data is sent to external servers.
- Required permissions: `storage`, `downloads`, `scripting`, `tabs`, `contextMenus`, `notifications`, and host access for pages where it operates.
- The extension does not circumvent paywalls or provide access to content you are not authorized to download. Users are responsible for complying with copyright and site terms.

Feedback & support
- Open an issue in the repository or contact the author for questions and bug reports.

Enjoy — and use responsibly.