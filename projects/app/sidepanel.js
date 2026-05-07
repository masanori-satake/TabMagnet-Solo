/**
 * TabMagnet-Solo Sidepanel エントリポイント
 * 各モジュールを調整し、UIの初期化とイベント設定を行う
 */

import { state, loadState, saveTargets, saveSettings } from './ui/state.js';
import { applyI18n } from './ui/i18n.js';
import { showToast } from './ui/toast.js';
import { renderTargetList, handleDragOver } from './ui/list-renderer.js';
import {
  showTargetModal,
  hideTargetModal,
  addPatternInput,
  hideModalFeedback,
  showModalFeedback,
  handlePatternDragOver
} from './ui/modal-target.js';
import {
  renderSettingsUI,
  updateAboutInfo,
  showSettingsModal,
  hideSettingsModal
} from './ui/modal-settings.js';
import {
  showDeleteDialog,
  hideDeleteDialog
} from './ui/dialog-delete.js';
import {
  getExportTimestamp,
  DEFAULT_SETTINGS,
  isSpecialPage,
  getCompatibleColor
} from './ui/utils.js';

// DOM elements
const targetListEl = document.getElementById('target-list');
const addNewBtn = document.getElementById('add-new-btn');
const addFromDomainBtn = document.getElementById('add-from-domain-btn');
const settingsBtn = document.getElementById('settings-btn');

// Target Modal elements
const targetModalScrim = document.getElementById('target-modal-scrim');
const newNameInput = document.getElementById('new-name');
const patternListContainer = document.getElementById('pattern-list-container');
const addPatternBtn = document.getElementById('add-pattern-btn');
const deleteTargetBtn = document.getElementById('delete-target-btn');
const cancelTargetBtn = document.getElementById('cancel-target-btn');
const saveTargetBtn = document.getElementById('save-target-btn');

// Settings Modal elements
const settingsModalScrim = document.getElementById('settings-modal-scrim');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const tabItems = document.querySelectorAll('.tab-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const collectAllGroupsSwitch = document.getElementById('collect-all-groups-switch');
const collapseAfterCollectSwitch = document.getElementById('collapse-after-collect-switch');
const discardTabsSwitch = document.getElementById('discard-tabs-switch');
const closeDuplicateTabsSwitch = document.getElementById('close-duplicate-tabs-switch');
const keepTMOrderSwitch = document.getElementById('keep-tm-order-switch');
const copyExportBtn = document.getElementById('copy-export-btn');
const pasteImportBtn = document.getElementById('paste-import-btn');
const fileExportBtn = document.getElementById('file-export-btn');
const fileImportBtn = document.getElementById('file-import-btn');
const fileInput = document.getElementById('file-input');

// Delete Dialog elements
const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
const confirmDeleteCancelBtn = document.getElementById('confirm-delete-cancel-btn');
const confirmDeleteOkBtn = document.getElementById('confirm-delete-ok-btn');

/**
 * 初期化処理
 */
export async function init() {
  applyI18n();
  await loadState();

  renderTargetList(showTargetModal);
  renderSettingsUI();
  setupEventListeners();
  updateDomainButtonState();
  updateAboutInfo();

  // ストレージの変更を監視
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.targets) {
      const nextTargets = changes.targets.newValue || [];
      if (JSON.stringify(nextTargets) !== JSON.stringify(state.targets)) {
        state.targets = nextTargets;
        renderTargetList(showTargetModal);
        updateAboutInfo();
      }
    }
    if (changes.settings) {
      const nextSettings = changes.settings.newValue || {};
      if (JSON.stringify(nextSettings) !== JSON.stringify(state.settings)) {
        state.settings = { ...state.settings, ...nextSettings };
        renderSettingsUI();
      }
    }
  });

  chrome.tabs.onActivated.addListener(updateDomainButtonState);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      updateDomainButtonState();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

/**
 * 現在のタブに応じたドメイン追加ボタンの活性制御
 */
async function updateDomainButtonState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || isSpecialPage(tab.url)) {
    addFromDomainBtn.classList.add('disabled');
  } else {
    addFromDomainBtn.classList.remove('disabled');
  }
}

/**
 * 各種イベントリスナーの設定
 */
function setupEventListeners() {
  // メインリスト
  targetListEl.addEventListener('dragover', handleDragOver);
  targetListEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    const items = [...targetListEl.querySelectorAll('.target-list-item')];
    const newTargets = items.map(item => state.targets[parseInt(item.dataset.index)]);
    await saveTargets(newTargets);
    renderTargetList(showTargetModal);
  });

  // フッターボタン
  addNewBtn.addEventListener('click', () => showTargetModal());
  addFromDomainBtn.addEventListener('click', handleAddFromDomain);
  settingsBtn.addEventListener('click', showSettingsModal);

  // ターゲットモーダル
  addPatternBtn.addEventListener('click', () => {
    addPatternInput();
    hideModalFeedback();
  });
  cancelTargetBtn.addEventListener('click', hideTargetModal);
  saveTargetBtn.addEventListener('click', handleSaveTarget);
  deleteTargetBtn.addEventListener('click', () => showDeleteDialog(state.currentEditIndex));

  newNameInput.addEventListener('input', hideModalFeedback);

  // カラーオプションのイベントリスナーは modal-target.js 内の renderColorOptions で設定されます

  patternListContainer.addEventListener('dragover', handlePatternDragOver);

  // 設定モーダル
  collectAllGroupsSwitch.addEventListener('change', () => {
    saveSettings({ collectFromAllGroups: collectAllGroupsSwitch.checked });
  });

  collapseAfterCollectSwitch.addEventListener('change', async () => {
    await saveSettings({ collapseAfterCollect: collapseAfterCollectSwitch.checked });
    renderSettingsUI();
  });

  discardTabsSwitch.addEventListener('change', () => {
    saveSettings({ discardTabsAfterCollect: discardTabsSwitch.checked });
  });

  closeDuplicateTabsSwitch.addEventListener('change', () => {
    saveSettings({ closeDuplicateTabs: closeDuplicateTabsSwitch.checked });
  });

  keepTMOrderSwitch.addEventListener('change', () => {
    saveSettings({ keepTMOrder: keepTMOrderSwitch.checked });
  });

  closeSettingsBtn.addEventListener('click', hideSettingsModal);

  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
      tabPanes.forEach(p => p.classList.toggle('hidden', p.id !== `tab-content-${targetTab}`));
    });
  });

  copyExportBtn.addEventListener('click', handleCopyExport);
  pasteImportBtn.addEventListener('click', handlePasteImport);
  fileExportBtn.addEventListener('click', handleFileExport);
  fileImportBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileImport);

  // 削除ダイアログ
  confirmDeleteCancelBtn.addEventListener('click', hideDeleteDialog);
  confirmDeleteOkBtn.addEventListener('click', handleConfirmDelete);

  // モーダル外側クリック
  [targetModalScrim, settingsModalScrim, deleteDialogScrim].forEach(scrim => {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) {
        if (scrim === targetModalScrim) hideTargetModal();
        if (scrim === settingsModalScrim) hideSettingsModal();
        if (scrim === deleteDialogScrim) hideDeleteDialog();
      }
    });
  });
}

/**
 * ターゲットの保存処理
 */
async function handleSaveTarget() {
  const name = newNameInput.value.trim();
  const rawPatterns = [...patternListContainer.querySelectorAll('.pattern-input')]
    .map(input => input.value.trim())
    .filter(val => val !== '');

  if (!name || rawPatterns.length === 0) {
    showModalFeedback(chrome.i18n.getMessage('errorInputRequired'));
    return;
  }

  const patterns = [];
  let hasSpecialPage = false;

  for (let p of rawPatterns) {
    if (/^https?:\/\//i.test(p)) {
      p = p.replace(/^https?:\/\//i, '');
    } else if (/^[a-z0-9-]+:\/\//i.test(p) || p.startsWith('about:') || p.startsWith('file:')) {
      hasSpecialPage = true;
    }
    patterns.push(p);
  }

  if (hasSpecialPage) {
    showModalFeedback(chrome.i18n.getMessage('warningSpecialPageIncluded'));
    return;
  }

  const targetData = { name, pattern: patterns, color: state.selectedColor };
  const newTargets = [...state.targets];

  if (state.currentEditIndex !== null) {
    newTargets[state.currentEditIndex] = targetData;
  } else {
    newTargets.push(targetData);
  }

  await saveTargets(newTargets);
  renderTargetList(showTargetModal);
  hideTargetModal();
}

/**
 * 現在のタブドメインからターゲットを自動生成
 */
async function handleAddFromDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || isSpecialPage(tab.url)) {
    if (tab && isSpecialPage(tab.url)) {
      showToast(chrome.i18n.getMessage('errorSpecialPage'));
    }
    return;
  }
  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const parts = domain.split('.');

    const skipList = ['www', 'mail', 'app', 'blog'];
    let mainPart = parts[0];
    if (parts.length > 2 && skipList.includes(parts[0].toLowerCase())) {
      mainPart = parts[1];
    }

    const name = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    const pattern = domain + '/*';

    showTargetModal();
    newNameInput.value = name;
    patternListContainer.innerHTML = '';
    addPatternInput(pattern);
  } catch (e) {
    console.error('Failed to parse current URL:', e);
  }
}

/**
 * データのインポート処理共通
 * @param {Object} data - インポートする JSON データ
 */
async function importData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid format');
  }

  // インポートするターゲットの取得とブラウザ互換色への変換
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const importedTargets = targets.map(target => ({
    ...target,
    color: target.color ? getCompatibleColor(target.color) : 'grey'
  }));

  // 設定の取得
  const importedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };

  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  if (mode === 'append') {
    await saveTargets([...state.targets, ...importedTargets]);
  } else {
    await saveTargets(importedTargets);
    await saveSettings(importedSettings);
  }

  renderTargetList(showTargetModal);
  renderSettingsUI();
  showToast(chrome.i18n.getMessage('importSuccess'));
}

/**
 * クリップボードからのインポート
 */
async function handlePasteImport() {
  try {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text);
    await importData(data);
  } catch (err) {
    showToast(chrome.i18n.getMessage('importError'));
  }
}

/**
 * クリップボードへのエクスポート
 */
async function handleCopyExport() {
  try {
    const exportData = { targets: state.targets, settings: state.settings };
    const json = JSON.stringify(exportData, null, 2);
    await navigator.clipboard.writeText(json);
    showToast(chrome.i18n.getMessage('copied'));
  } catch (err) {
    console.error('Failed to copy targets:', err);
  }
}

/**
 * ファイルへのエクスポート
 */
function handleFileExport() {
  const exportData = { targets: state.targets, settings: state.settings };
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `tabmagnet_${getExportTimestamp()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ファイルからのインポート
 */
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      await importData(data);
    } catch (err) {
      showToast(chrome.i18n.getMessage('importError'));
    }
    fileInput.value = '';
  };
  reader.readAsText(file);
}

/**
 * 削除の最終実行
 */
async function handleConfirmDelete() {
  if (state.currentDeleteIndex !== null) {
    const newTargets = [...state.targets];
    newTargets.splice(state.currentDeleteIndex, 1);
    await saveTargets(newTargets);
    renderTargetList(showTargetModal);
  }
  hideDeleteDialog();
  hideTargetModal();
}
