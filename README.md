# homepad

A customizable Chrome **home page** (new tab page replacement).

The goal of the project is to turn Chrome's new tab into a useful home base — starting from a familiar Google-style layout and adding panels for things you actually do in the browser. Built with plain Manifest V3 (no framework, no build step) so it stays easy to fork and tweak.

> Русская версия: [README.ru.md](./README.ru.md)

## Current features

- **Main area** — Google logo, search bar and a grid of most-visited sites (mirrors Chrome's default NTP).
- **Sidebar, top section** — currently open tabs (favicon + title). A `+` button next to each tab saves it to the "Read later" section. The list updates live as tabs are opened or closed.
- **Sidebar, bottom section** — saved links. Click the title to open the page in a new tab; click `×` to remove. Stored locally via `chrome.storage.local`.

## Install (Developer mode)

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this project folder.
4. Open a new tab (`Cmd+T` / `Ctrl+T`).

## Project layout

```
manifest.json    — Manifest V3, new tab override
newtab.html      — page markup
newtab.css       — styles
newtab.js        — logic (open tabs, saved tabs, top sites)
icons/           — extension icons (placeholders)
```

## Technical notes

- Manifest V3. No background service worker — all logic lives in the new tab page itself.
- Permissions: `tabs`, `topSites`, `storage`, `favicon`.
- Storage: `chrome.storage.local`. No cross-device sync (by design).
- Live updates: subscribes to `chrome.tabs.onCreated/onRemoved/onUpdated/onMoved/onAttached/onDetached/onReplaced` (debounced at 100 ms) and `chrome.storage.onChanged` so multiple open new tab pages stay in sync.
- Favicons: for open tabs we use `tab.favIconUrl` directly; for saved items and top sites we use the MV3 `_favicon` API (`chrome.runtime.getURL("/_favicon/?pageUrl=...&size=32")`).
- Duplicate protection: when an open tab's URL is already saved, its `+` button is replaced with a disabled `✓`.
- Icons under `icons/` are temporary placeholders — replace with final assets when ready.

## Roadmap ideas

- Themes (light/dark, custom backgrounds).
- More home-page widgets (bookmarks, recent history, notes, weather).
- Folders / tags for saved links.
- Optional `chrome.storage.sync` for cross-device sync.
