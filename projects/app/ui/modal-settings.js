import { state } from './state.js';

/**
 * 設定値をUI（スイッチの状態など）に反映
 */
export function renderSettingsUI() {
  const collectAllGroupsSwitch = document.getElementById('collect-all-groups-switch');
  const collapseAfterCollectSwitch = document.getElementById('collapse-after-collect-switch');
  const discardTabsContainer = document.getElementById('discard-tabs-container');
  const discardTabsSwitch = document.getElementById('discard-tabs-switch');
  const closeDuplicateTabsSwitch = document.getElementById('close-duplicate-tabs-switch');
  const keepTMOrderSwitch = document.getElementById('keep-tm-order-switch');

  if (collectAllGroupsSwitch) collectAllGroupsSwitch.checked = !!state.settings.collectFromAllGroups;
  if (collapseAfterCollectSwitch) collapseAfterCollectSwitch.checked = !!state.settings.collapseAfterCollect;
  if (discardTabsSwitch) discardTabsSwitch.checked = !!state.settings.discardTabsAfterCollect;
  if (closeDuplicateTabsSwitch) closeDuplicateTabsSwitch.checked = !!state.settings.closeDuplicateTabs;
  if (keepTMOrderSwitch) keepTMOrderSwitch.checked = !!state.settings.keepTMOrder;

  if (state.settings.collapseAfterCollect) {
    if (discardTabsContainer) discardTabsContainer.classList.remove('disabled');
    if (discardTabsSwitch) discardTabsSwitch.disabled = false;
  } else {
    if (discardTabsContainer) discardTabsContainer.classList.add('disabled');
    if (discardTabsSwitch) discardTabsSwitch.disabled = true;
  }
}

/**
 * Aboutタブの情報を更新
 */
export function updateAboutInfo() {
  const aboutVersionEl = document.getElementById('about-version');
  const aboutDeveloperEl = document.getElementById('about-developer');
  const aboutTargetCountEl = document.getElementById('about-target-count');

  const manifest = chrome.runtime.getManifest();
  if (aboutVersionEl) aboutVersionEl.textContent = `v${manifest.version}`;
  if (aboutDeveloperEl) aboutDeveloperEl.textContent = manifest.author || 'Masanori SATAKE';
  if (aboutTargetCountEl) aboutTargetCountEl.textContent = state.targets.length;
}

/**
 * 設定モーダルを表示
 */
export function showSettingsModal() {
  const settingsModalScrim = document.getElementById('settings-modal-scrim');
  if (settingsModalScrim) settingsModalScrim.style.display = 'flex';
  updateAboutInfo();
}

/**
 * 設定モーダルを閉じる
 */
export function hideSettingsModal() {
  const settingsModalScrim = document.getElementById('settings-modal-scrim');
  if (settingsModalScrim) settingsModalScrim.style.display = 'none';
}
