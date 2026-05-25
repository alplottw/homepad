"use strict";

const STORAGE_KEY = "savedTabs";
const RENDER_DEBOUNCE_MS = 100;
const NTP_URL = chrome.runtime.getURL("newtab.html");

const els = {
  openList: document.getElementById("open-tabs"),
  savedList: document.getElementById("saved-tabs"),
  topSites: document.getElementById("top-sites"),
  tplOpen: document.getElementById("tpl-open-tab"),
  tplSaved: document.getElementById("tpl-saved-tab"),
  tplTopSite: document.getElementById("tpl-top-site"),
};

let savedTabs = [];
let openTabsCache = [];

// ---------- utils ----------

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function faviconForUrl(url) {
  // Use the MV3 `_favicon` API to get Chrome's cached favicon for a URL.
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", url);
  u.searchParams.set("size", "32");
  return u.toString();
}

function tabFavicon(tab) {
  if (tab.favIconUrl && /^https?:|^data:/.test(tab.favIconUrl)) {
    return tab.favIconUrl;
  }
  return tab.url ? faviconForUrl(tab.url) : "";
}

function isOwnNewTabPage(tab) {
  return tab.url === NTP_URL || tab.pendingUrl === NTP_URL;
}

// ---------- storage ----------

async function loadSaved() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  savedTabs = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function persistSaved(next) {
  savedTabs = next;
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

// ---------- actions ----------

async function saveTab(tab) {
  if (savedTabs.some((t) => t.url === tab.url)) return;
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: tab.url,
    title: tab.title || tab.url,
    favIconUrl: tabFavicon(tab),
    savedAt: Date.now(),
    pinned: false,
    pinnedAt: null,
  };
  await persistSaved([...savedTabs, item]);
  renderSaved();
  renderOpen();
}

async function removeSaved(id) {
  await persistSaved(savedTabs.filter((t) => t.id !== id));
  renderSaved();
  renderOpen();
}

async function togglePin(id) {
  const next = savedTabs.map((t) =>
    t.id === id
      ? { ...t, pinned: !t.pinned, pinnedAt: !t.pinned ? Date.now() : null }
      : t
  );
  await persistSaved(next);
  renderSaved();
}

// ---------- render ----------

function renderOpen() {
  const frag = document.createDocumentFragment();
  const savedUrls = new Set(savedTabs.map((t) => t.url));

  const tabs = openTabsCache.filter((t) => !isOwnNewTabPage(t));

  for (const tab of tabs) {
    const node = els.tplOpen.content.firstElementChild.cloneNode(true);
    const icon = node.querySelector(".tab-favicon");
    const title = node.querySelector(".tab-title");
    const btn = node.querySelector(".btn-save");

    icon.src = tabFavicon(tab);
    icon.onerror = () => {
      icon.removeAttribute("src");
    };
    title.textContent = tab.title || tab.url;
    title.title = `${tab.title || ""}\n${tab.url}`;

    const alreadySaved = savedUrls.has(tab.url);
    if (alreadySaved) {
      btn.textContent = "✓";
      btn.title = "Уже сохранено";
      btn.setAttribute("aria-label", "Уже сохранено");
      btn.classList.add("is-saved");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => saveTab(tab));
    }

    frag.appendChild(node);
  }

  els.openList.replaceChildren(frag);
}

function renderSaved() {
  const frag = document.createDocumentFragment();

  // Pinned first (newest pin on top), then unpinned (newest save on top).
  const pinned = savedTabs
    .filter((t) => t.pinned)
    .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
  const rest = savedTabs
    .filter((t) => !t.pinned)
    .sort((a, b) => b.savedAt - a.savedAt);
  const items = [...pinned, ...rest];

  for (const item of items) {
    const node = els.tplSaved.content.firstElementChild.cloneNode(true);
    const icon = node.querySelector(".tab-favicon");
    const link = node.querySelector(".tab-link");
    const pinBtn = node.querySelector(".btn-pin");
    const removeBtn = node.querySelector(".btn-remove");

    if (item.pinned) {
      node.classList.add("is-pinned");
      pinBtn.title = "Открепить";
      pinBtn.setAttribute("aria-label", "Открепить");
    }

    icon.src = item.favIconUrl || faviconForUrl(item.url);
    icon.onerror = () => {
      icon.removeAttribute("src");
    };
    link.textContent = item.title || item.url;
    link.title = `${item.title || ""}\n${item.url}`;
    link.href = item.url;

    pinBtn.addEventListener("click", (e) => {
      e.preventDefault();
      togglePin(item.id);
    });

    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      removeSaved(item.id);
    });

    frag.appendChild(node);
  }

  els.savedList.replaceChildren(frag);
}

async function renderTopSites() {
  let sites = [];
  try {
    sites = await chrome.topSites.get();
  } catch (e) {
    console.warn("topSites.get failed", e);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const site of sites.slice(0, 10)) {
    const node = els.tplTopSite.content.firstElementChild.cloneNode(true);
    const icon = node.querySelector(".top-site-icon");
    const title = node.querySelector(".top-site-title");

    node.href = site.url;
    icon.src = faviconForUrl(site.url);
    icon.onerror = () => {
      icon.removeAttribute("src");
    };
    title.textContent = site.title || new URL(site.url).hostname;
    title.title = site.title || site.url;

    frag.appendChild(node);
  }
  els.topSites.replaceChildren(frag);
}

// ---------- live updates ----------

async function refreshOpenTabs() {
  openTabsCache = await chrome.tabs.query({});
  renderOpen();
}

const refreshOpenTabsDebounced = debounce(refreshOpenTabs, RENDER_DEBOUNCE_MS);

function attachListeners() {
  chrome.tabs.onCreated.addListener(refreshOpenTabsDebounced);
  chrome.tabs.onRemoved.addListener(refreshOpenTabsDebounced);
  chrome.tabs.onUpdated.addListener(refreshOpenTabsDebounced);
  chrome.tabs.onMoved.addListener(refreshOpenTabsDebounced);
  chrome.tabs.onAttached.addListener(refreshOpenTabsDebounced);
  chrome.tabs.onDetached.addListener(refreshOpenTabsDebounced);
  chrome.tabs.onReplaced.addListener(refreshOpenTabsDebounced);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    savedTabs = Array.isArray(changes[STORAGE_KEY].newValue)
      ? changes[STORAGE_KEY].newValue
      : [];
    renderSaved();
    renderOpen();
  });
}

// ---------- init ----------

(async function init() {
  await loadSaved();
  openTabsCache = await chrome.tabs.query({});
  renderSaved();
  renderOpen();
  renderTopSites();
  attachListeners();
})();
