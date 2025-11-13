const toggle = document.getElementById('toggle');
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reloadAllTabsBtn');
const siteOriginEl = document.getElementById('siteOrigin');
const siteToggleBtn = document.getElementById('siteToggleBtn');

let currentOrigin = null;

async function init() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  toggle.checked = !!enabled;
  statusEl.textContent = `Status: ${enabled ? 'active' : 'inactive'}`;
  // keep reload button always enabled (independent from extension enabled state)

  // determine current tab origin
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (tab && tab.url && /^https?:\/\//i.test(tab.url)) {
      try { currentOrigin = new URL(tab.url).origin; } catch (e) { currentOrigin = null; }
    } else {
      currentOrigin = null;
    }
  } catch (e) { currentOrigin = null; }

  // display without scheme and without leading www. for a cleaner look
  const displayOrigin = currentOrigin ? currentOrigin.replace(/^https?:\/\//i, '').replace(/\/$/, '').replace(/^www\./i, '') : '—';
  siteOriginEl.textContent = displayOrigin;
  // show full origin on hover
  siteOriginEl.title = currentOrigin || '';

  // reflect blacklist state
  if (siteToggleBtn) {
    if (!currentOrigin) {
      siteToggleBtn.disabled = true;
      siteToggleBtn.textContent = 'Unavailable Here';
    } else {
      const st = await chrome.storage.local.get('blacklist');
      const arr = Array.isArray(st.blacklist) ? st.blacklist : [];
      const isBlack = arr.includes(currentOrigin);
      siteToggleBtn.disabled = false;
      siteToggleBtn.textContent = isBlack ? 'Remove exclusion' : 'Exclude this site';
    }
  }
}

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  await chrome.storage.local.set({ enabled });
  statusEl.textContent = `Status: ${enabled ? 'active' : 'inactive'}`;
});

if (reloadBtn) {
  reloadBtn.addEventListener('click', () => {
    try { chrome.runtime.sendMessage({ action: 'reloadAllTabs' }); } catch (e) { }
  });
}

if (siteToggleBtn) {
  siteToggleBtn.addEventListener('click', async () => {
    if (!currentOrigin) return;
    const st = await chrome.storage.local.get('blacklist');
    const arr = Array.isArray(st.blacklist) ? st.blacklist : [];
    const isBlack = arr.includes(currentOrigin);
    try {
      if (!isBlack) {
        chrome.runtime.sendMessage({ action: 'addOriginToBlacklist', origin: currentOrigin });
        siteToggleBtn.textContent = 'Remove exclusion';
      } else {
        chrome.runtime.sendMessage({ action: 'removeOriginFromBlacklist', origin: currentOrigin });
        siteToggleBtn.textContent = 'Exclude this site';
      }
    } catch (e) { }
  });
}

init();
