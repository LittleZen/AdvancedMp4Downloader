const toggle = document.getElementById('toggle');
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reloadAllTabsBtn');

async function init() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  toggle.checked = !!enabled;
  statusEl.textContent = `Stato: ${enabled ? 'attivo' : 'disattivo'}`;
  if (reloadBtn) reloadBtn.disabled = !enabled;
}

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  await chrome.storage.local.set({ enabled });
  statusEl.textContent = `Stato: ${enabled ? 'attivo' : 'disattivo'}`;
  if (reloadBtn) reloadBtn.disabled = !enabled;
});

if (reloadBtn) {
  reloadBtn.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'reloadAllTabs' });
    } catch (e) { }
  });
}

init();
