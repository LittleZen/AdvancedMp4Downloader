// background.js — clean implementation
// - per-origin blacklist stored in chrome.storage.local.blacklist
// - reload all tabs (skips blacklisted origins)
// - remembers last save directory in current session

let enabled = true;
let lastSaveDir = "";
let blacklistedOrigins = new Set();

async function loadState() {
  const st = await chrome.storage.local.get(['enabled', 'blacklist']);
  enabled = st.enabled !== undefined ? !!st.enabled : true;
  blacklistedOrigins = Array.isArray(st.blacklist) ? new Set(st.blacklist) : new Set();
  await updateUIAndMenus();
}

(async () => { await loadState(); })();

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if ('enabled' in changes) {
    enabled = !!changes.enabled.newValue;
    await updateUIAndMenus();
  }
  if ('blacklist' in changes) {
    const nv = changes.blacklist.newValue;
    blacklistedOrigins = Array.isArray(nv) ? new Set(nv) : new Set();
    // when blacklist changes, refresh the context menu state for active tab
    await updateMenusForActiveTab();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const st = await chrome.storage.local.get('enabled');
  if (st.enabled === undefined) await chrome.storage.local.set({ enabled: true });
  await loadState();
});

function originFromUrl(url) { try { return new URL(url).origin; } catch (e) { return null; } }

async function reloadAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      const url = t.url || '';
      if (!/^https?:\/\//i.test(url)) continue;
      const origin = originFromUrl(url);
      if (origin && blacklistedOrigins.has(origin)) continue;
      try { await chrome.tabs.reload(t.id, { bypassCache: false }); } catch (_) {}
    }
  } catch (_) {}
}

chrome.action.onClicked.addListener(() => {
  // allow manual reload via action click regardless of extension enabled state
  reloadAllTabs();
});

async function updateMenusForTabId(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const origin = originFromUrl(tab?.url || '');
    const disabled = origin && blacklistedOrigins.has(origin);
    try { chrome.contextMenus.update('dl-mp4', { enabled: !disabled }); } catch (_) {}
    try { chrome.contextMenus.update('find-mp4', { enabled: !disabled }); } catch (_) {}
  } catch (_) {}
}

async function updateMenusForActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (tab) await updateMenusForTabId(tab.id);
  } catch (_) {}
}

// update menus when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateMenusForTabId(activeInfo.tabId);
});

async function updateUIAndMenus() {
  try { await chrome.contextMenus.removeAll(); } catch (_) {}
  if (enabled) {
    chrome.contextMenus.create({ id: 'dl-mp4', title: 'Scarica MP4', contexts: ['link','video','audio'] });
    chrome.contextMenus.create({ id: 'find-mp4', title: 'Trova & scarica MP4 nella pagina', contexts: ['page'] });
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Scarica MP4 (attivo)' });
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: '#d00' });
    await chrome.action.setBadgeText({ text: 'OFF' });
    await chrome.action.setTitle({ title: 'Scarica MP4 (disattivo)' });
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!enabled) return;
  if (info.status !== 'complete') return;
  if (!/^https?:\/\//.test(tab?.url || '')) return;
  const origin = originFromUrl(tab.url);
  if (origin && blacklistedOrigins.has(origin)) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, css: `*{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important;}` });
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['unlock-right-click.js'] });
  } catch (_) {}
});

async function findMp4(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const urls = new Set();
      document.querySelectorAll('video[src],audio[src],source[src],a[href]').forEach(el => {
        const u = el.src || el.href;
        if (u && /\.mp4(\b|[?#/])/i.test(u)) urls.add(u);
      });
      const arr = [...urls];
      arr.sort((a,b) => {
        const rs = s => (s.includes('2160')||s.toLowerCase().includes('4k'))?5:s.includes('1080')?4:s.includes('720')?3:s.includes('480')?2:s.includes('360')?1:0;
        return rs(b)-rs(a);
      });
      return arr[0] || null;
    }
  });
  return result || null;
}

function extractName(u) {
  const m = u.match(/([^\/\?#]+\.mp4)/i);
  const name = m ? m[1] : 'video.mp4';
  return name.replace(/[\\/:*?"<>|]+/g, '_');
}

async function showExcludedNotification(origin) {
  try {
    const nid = 'excluded-' + Date.now();
    const opts = {
      type: 'basic',
      title: 'Sito escluso',
      message: `L'estensione è disattivata su ${origin}. Apri il popup per rimuovere l'esclusione.`,
      iconUrl: chrome.runtime.getURL('icon48.png')
    };
    return new Promise((resolve) => {
      try {
        chrome.notifications.create(nid, opts, () => {
          setTimeout(() => { try { chrome.notifications.clear(nid); } catch(_) {} ; resolve(); }, 4000);
        });
      } catch (e) {
        // fallback: no notifications available
        console.warn('showExcludedNotification failed', e);
        resolve();
      }
    });
  } catch (e) { console.warn('showExcludedNotification error', e); }
}

chrome.downloads.onChanged.addListener(delta => {
  try {
    if (delta.filename && delta.filename.current) {
      const full = delta.filename.current;
      const dir = full.replace(/[^\/\\]+$/, '').replace(/^[\\\/]+/, '').replace(/[\\\/]+$/, '');
      if (dir) lastSaveDir = dir;
    }
  } catch (_) {}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!enabled) return;
  const origin = originFromUrl(tab?.url);
  if (origin && blacklistedOrigins.has(origin)) {
    try { await showExcludedNotification(origin); } catch (_) {}
    return;
  }
  if (info.menuItemId === 'dl-mp4') {
    let url = info.srcUrl || info.linkUrl;
    try {
      if (!url) {
        // try to find an mp4 in the page
        url = await findMp4(tab.id);
      }
      if (!url) {
        console.warn('dl-mp4: no URL found to download', info, tab);
        return;
      }
      // Use saveAs:true and omit filename so Chrome prompts for location
      console.log('dl-mp4: starting download for', url);
      try {
        const id = await chrome.downloads.download({ url, saveAs: true });
        console.log('dl-mp4: download started id=', id);
      } catch (err) {
        console.error('dl-mp4: download failed', err);
      }
    } catch (e) {
      console.error('dl-mp4: error', e);
    }
  }
  if (info.menuItemId === 'find-mp4') {
    try {
      const candidate = await findMp4(tab.id);
      if (!candidate) {
        console.warn('find-mp4: no candidate found in page', tab.id);
        return;
      }
      console.log('find-mp4: starting download for', candidate);
      try {
        const id = await chrome.downloads.download({ url: candidate, saveAs: true });
        console.log('find-mp4: download started id=', id);
      } catch (err) {
        console.error('find-mp4: download failed', err);
      }
    } catch (e) {
      console.error('find-mp4: error', e);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (!msg || !msg.action) return;
    if (msg.action === 'reloadAllTabs') {
      // allow popup to request reload even if the extension is globally disabled
      reloadAllTabs();
      return;
    }
    if (msg.action === 'addOriginToBlacklist' && msg.origin) {
      (async () => {
        const st = await chrome.storage.local.get('blacklist');
        const arr = Array.isArray(st.blacklist) ? st.blacklist : [];
        if (!arr.includes(msg.origin)) {
          arr.push(msg.origin);
          await chrome.storage.local.set({ blacklist: arr });
        }
        // reload current active tab and update menus
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs && tabs[0];
          if (tab) {
            try { await chrome.tabs.reload(tab.id); } catch (_) {}
            await updateMenusForTabId(tab.id);
          }
        } catch (_) {}
      })();
      return;
    }
    if (msg.action === 'removeOriginFromBlacklist' && msg.origin) {
      (async () => {
        const st = await chrome.storage.local.get('blacklist');
        const arr = Array.isArray(st.blacklist) ? st.blacklist : [];
        const out = arr.filter(x => x !== msg.origin);
        await chrome.storage.local.set({ blacklist: out });
        // reload current active tab and update menus
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs && tabs[0];
          if (tab) {
            try { await chrome.tabs.reload(tab.id); } catch (_) {}
            await updateMenusForTabId(tab.id);
          }
        } catch (_) {}
      })();
      return;
    }
  } catch (_) {}
});