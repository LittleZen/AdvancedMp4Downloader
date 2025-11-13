// ---- variabili globali ----
let enabled = true;
let lastSaveDir = ""; // nuova variabile di sessione per ricordare l'ultima cartella

// carica stato all'avvio del SW
(async function bootstrap() {
  const st = await chrome.storage.local.get('enabled');
  enabled = st.enabled !== undefined ? !!st.enabled : true;
  await updateUIAndMenus();
})();

// aggiorna se cambia da popup/altrove
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !('enabled' in changes)) return;
  enabled = !!changes.enabled.newValue;
  await updateUIAndMenus();
});

// installazione: imposta default se mancante
chrome.runtime.onInstalled.addListener(async () => {
  const st = await chrome.storage.local.get('enabled');
  if (st.enabled === undefined) await chrome.storage.local.set({ enabled: true });
  await updateUIAndMenus();
});

// ---- ricarica le tab attive in ogni finestra (per injectare il cambiamento) ----
async function reloadActiveTabs() {
  try {
    // query all tabs across all windows
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      const url = t.url || "";
      // ricarichiamo solo http/https (evita chrome://, file://, about:blank, ecc.)
      if (/^https?:\/\//i.test(url)) {
        try { await chrome.tabs.reload(t.id, { bypassCache: false }); } catch (_) {}
      }
    }
  } catch (_) {}
}

// --- aggiungi handler per click sull'icona: bottone per aggiornare tutte le tab ---
chrome.action.onClicked.addListener(() => {
  if (!enabled) return;
  reloadActiveTabs();
});

// crea/rimuove i context menu e aggiorna badge/titolo
async function updateUIAndMenus() {
  try { await chrome.contextMenus.removeAll(); } catch (_) {}
  if (enabled) {
    chrome.contextMenus.create({
      id: "dl-mp4",
      title: "Scarica MP4",
      contexts: ["link", "video", "audio"]
    });
    chrome.contextMenus.create({
      id: "find-mp4",
      title: "Trova & scarica MP4 nella pagina",
      contexts: ["page"]
    });
    await chrome.action.setBadgeText({ text: "" }); // nessun badge quando attivo
    await chrome.action.setTitle({ title: "Scarica MP4 (attivo)" });
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: "#d00" });
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setTitle({ title: "Scarica MP4 (disattivo)" });
  }
}

// iniezione sblocco SOLO se attivo
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!enabled) return;
  if (info.status !== "complete") return;
  if (!/^https?:\/\//.test(tab?.url || "")) return;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: `*{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important;}`
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["unlock-right-click.js"]
    });
  } catch (_) {}
});

// ---- engine ----
async function findMp4(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const urls = new Set();
      document.querySelectorAll("video[src],audio[src],source[src],a[href]").forEach(el => {
        const u = el.src || el.href;
        if (u && /\.mp4(\b|[?#/])/i.test(u)) urls.add(u);
      });
      const arr = [...urls];
      arr.sort((a,b) => {
        const rs = s => (s.includes("2160")||s.toLowerCase().includes("4k"))?5:s.includes("1080")?4:s.includes("720")?3:s.includes("480")?2:s.includes("360")?1:0;
        return rs(b)-rs(a);
      });
      return arr[0] || null;
    }
  });
  return result || null;
}

function extractName(u) {
  const m = u.match(/([^\/?#]+\.mp4)/i);
  const name = m ? m[1] : "video.mp4";
  return name.replace(/[\\/:*?"<>|]+/g, "_");
}

// salva directory scelta dall'utente quando il filename cambia (es. dopo Save As)
chrome.downloads.onChanged.addListener(delta => {
  try {
    if (delta.filename && delta.filename.current) {
      const full = delta.filename.current;
      // ottieni solo la parte di directory (rimuove l'ultimo componente)
      const dir = full.replace(/[^\/\\]+$/, "").replace(/^[\\\/]+/, "").replace(/[\\\/]+$/, "");
      if (dir) lastSaveDir = dir;
    }
  } catch (_) {}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!enabled) return; // in pausa, ignora click
  if (info.menuItemId === "dl-mp4") {
    const url = info.srcUrl || info.linkUrl;
    if (!url) return;
    const filename = (lastSaveDir ? (lastSaveDir + "/") : "") + extractName(url);
    chrome.downloads.download({ url, filename, saveAs: true });
  }
  if (info.menuItemId === "find-mp4") {
    const candidate = await findMp4(tab.id);
    if (!candidate) return;
    const filename = (lastSaveDir ? (lastSaveDir + "/") : "") + extractName(candidate);
    chrome.downloads.download({ url: candidate, filename, saveAs: true });
  }
});

// riceve messaggi dal popup (es. clic su "Aggiorna tutte le tab")
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg && msg.action === 'reloadAllTabs') {
      if (!enabled) return; // se disattivato ignoriamo
      reloadActiveTabs();
    }
  } catch (_) {}
});
