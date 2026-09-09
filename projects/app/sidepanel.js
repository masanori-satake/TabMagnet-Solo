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
  hideSettingsModal,
  showSyncModal,
  hideSyncModal
} from './ui/modal-settings.js';
import {
  showDeleteDialog,
  hideDeleteDialog
} from './ui/dialog-delete.js';
import {
  getExportTimestamp,
  DEFAULT_SETTINGS,
  isSpecialPage,
  getCompatibleColor,
  isEdge
} from './ui/utils.js';
import { ALL_COLORS, COLOR_COMPATIBILITY_MAP } from './ui/constants.js';

// JSON 解析前に巨大な入力を拒否し、メモリの過剰消費を防ぐ。
export const MAX_IMPORT_DATA_SIZE = 1024 * 1024;
const ALLOWED_IMPORT_PROPERTIES = new Set(['targets', 'settings']);
const ALLOWED_TARGET_PROPERTIES = new Set(['name', 'pattern', 'color']);
const ALLOWED_SETTINGS_PROPERTIES = new Set(Object.keys(DEFAULT_SETTINGS));
const ALLOWED_TARGET_COLORS = new Set([...ALL_COLORS, ...Object.keys(COLOR_COMPATIBILITY_MAP)]);
const MAX_TARGET_COLOR_LENGTH = 20;

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
const syncEnabledSwitch = document.getElementById('sync-enabled-switch');
const copyExportBtn = document.getElementById('copy-export-btn');
const pasteImportBtn = document.getElementById('paste-import-btn');
const fileExportBtn = document.getElementById('file-export-btn');
const fileImportBtn = document.getElementById('file-import-btn');
const fileInput = document.getElementById('file-input');

// Delete Dialog elements
const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
const confirmDeleteCancelBtn = document.getElementById('confirm-delete-cancel-btn');
const confirmDeleteOkBtn = document.getElementById('confirm-delete-ok-btn');

// Paste Import Modal elements
const pasteImportModalScrim = document.getElementById('paste-import-modal-scrim');
const pasteImportTextarea = document.getElementById('paste-import-textarea');
const cancelPasteImportBtn = document.getElementById('cancel-paste-import-btn');
const confirmPasteImportBtn = document.getElementById('confirm-paste-import-btn');

// Sync Modal elements
const syncModalScrim = document.getElementById('sync-modal-scrim');
const cancelSyncBtn = document.getElementById('cancel-sync-btn');
const confirmSyncBtn = document.getElementById('confirm-sync-btn');

/**
 * 初期化処理
 */
export async function init() {
  if (isEdge()) {
    document.body.classList.add('edge-mode');
  }
  applyI18n();
  await loadState();

  renderTargetList(showTargetModal);
  renderSettingsUI();
  setupEventListeners();
  updateDomainButtonState();
  updateAboutInfo();

  // ストレージの変更を監視
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
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
    } else if (area === 'sync' && state.settings.syncEnabled) {
      if (changes.targets && changes.targets.newValue) {
        const nextTargets = changes.targets.newValue;
        state.targets = nextTargets;
        chrome.storage.local.set({ targets: nextTargets }).then(() => {
          renderTargetList(showTargetModal);
          updateAboutInfo();
        });
      }
      if (changes.settings && changes.settings.newValue) {
        const currentSyncEnabled = state.settings.syncEnabled;
        const nextSettings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue, syncEnabled: currentSyncEnabled };
        state.settings = { ...state.settings, ...nextSettings };
        chrome.storage.local.set({ settings: state.settings }).then(() => {
          renderSettingsUI();
        });
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
    const items = [...targetListEl.querySelectorAll('.target-list-item:not([data-static="true"])')];
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

  syncEnabledSwitch.addEventListener('change', async () => {
    if (syncEnabledSwitch.checked) {
      showSyncModal();
    } else {
      await saveSettings({ syncEnabled: false });
      renderSettingsUI();
    }
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

  // ペーストインポートモーダル
  cancelPasteImportBtn.addEventListener('click', hidePasteImportModal);
  confirmPasteImportBtn.addEventListener('click', handleConfirmPasteImport);

  // 同期モーダル
  cancelSyncBtn.addEventListener('click', handleCancelSync);
  confirmSyncBtn.addEventListener('click', handleConfirmSync);

  const syncOptionRadioInputs = document.querySelectorAll('input[name="sync-settings-option"], input[name="sync-targets-option"]');
  syncOptionRadioInputs.forEach(input => {
    input.addEventListener('change', updateSyncConfirmButtonState);
  });

  // モーダル外側クリック
  [targetModalScrim, settingsModalScrim, deleteDialogScrim, pasteImportModalScrim, syncModalScrim].forEach(scrim => {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) {
        if (scrim === targetModalScrim) hideTargetModal();
        if (scrim === settingsModalScrim) hideSettingsModal();
        if (scrim === deleteDialogScrim) hideDeleteDialog();
        if (scrim === pasteImportModalScrim) hidePasteImportModal();
        if (scrim === syncModalScrim) handleCancelSync();
      }
    });
  });
}

/**
 * 同期モーダルの確定ボタン活性状態を更新
 */
function updateSyncConfirmButtonState() {
  const selectedSettings = document.querySelector('input[name="sync-settings-option"]:checked');
  const selectedTargets = document.querySelector('input[name="sync-targets-option"]:checked');

  if (selectedSettings && selectedTargets) {
    confirmSyncBtn.classList.remove('disabled');
  } else {
    confirmSyncBtn.classList.add('disabled');
  }
}

/**
 * 同期設定モーダルのキャンセル処理
 */
function handleCancelSync() {
  hideSyncModal();
  syncEnabledSwitch.checked = false;
  saveSettings({ syncEnabled: false });
  renderSettingsUI();
}

/**
 * 同期設定モーダルの確定処理
 */
async function handleConfirmSync() {
  const selectedSettings = document.querySelector('input[name="sync-settings-option"]:checked')?.value;
  const selectedTargets = document.querySelector('input[name="sync-targets-option"]:checked')?.value;

  if (!selectedSettings || !selectedTargets) return;

  try {
    const syncData = await chrome.storage.sync.get(['settings', 'targets']);

    // 1. 設定項目の同期処理
    let finalSettings = { ...state.settings, syncEnabled: true };
    if (selectedSettings === 'from_sync') {
      if (syncData.settings) {
        finalSettings = { ...DEFAULT_SETTINGS, ...syncData.settings, syncEnabled: true };
      }
    }
    await saveSettings(finalSettings);

    // 2. タブグループ（ターゲット）の同期処理
    let finalTargets = [...state.targets];
    if (selectedTargets === 'from_sync') {
      if (syncData.targets) {
        finalTargets = syncData.targets.map(t => ({
          ...t,
          color: t.color ? getCompatibleColor(t.color) : 'grey'
        }));
      }
    }
    await saveTargets(finalTargets);

    // クラウド側へ最新のローカル状態をアップロードして同期を確定させる
    await chrome.storage.sync.set({
      settings: finalSettings,
      targets: finalTargets
    });

    renderSettingsUI();
    renderTargetList(showTargetModal);
    hideSyncModal();
  } catch (e) {
    console.error('Failed to initialize sync:', e);
    handleCancelSync();
  }
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
 * オブジェクトが許可されたプロパティだけを持つことを確認する
 * @param {Object} value - 検証対象
 * @param {Set<string>} allowedProperties - 許可するプロパティ名
 * @param {string} errorMessage - 不正時のエラーメッセージ
 * @throws {Error} 許可されていないプロパティが存在する場合
 */
function validateAllowedProperties(value, allowedProperties, errorMessage) {
  if (Object.keys(value).some(key => !allowedProperties.has(key))) {
    throw new Error(errorMessage);
  }
}

/**
 * インポートデータの構造・型・入力長を検証する
 * @param {Object} data - インポートする JSON データ
 * @throws {Error} インポートデータが許可スキーマに適合しない場合
 */
export function validateImportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid format');
  }
  validateAllowedProperties(data, ALLOWED_IMPORT_PROPERTIES, 'Invalid import property');

  if (!Array.isArray(data.targets)) {
    throw new Error('Invalid format: targets must be an array');
  }
  if (data.targets.length > 100) {
    throw new Error('Invalid format: targets array exceeds limit');
  }

  for (const target of data.targets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new Error('Invalid target element');
    }
    validateAllowedProperties(target, ALLOWED_TARGET_PROPERTIES, 'Invalid target property');
    if (typeof target.name !== 'string' || target.name.trim() === '' || target.name.length > 100) {
      throw new Error('Invalid target name');
    }
    const isPatternStringValid = typeof target.pattern === 'string' &&
      target.pattern.trim() !== '' &&
      target.pattern.length <= 500;
    const isPatternArrayValid = Array.isArray(target.pattern) &&
      target.pattern.length > 0 &&
      target.pattern.length <= 50 &&
      target.pattern.every(p => typeof p === 'string' && p.trim() !== '' && p.length <= 500);

    if (!isPatternStringValid && !isPatternArrayValid) {
      throw new Error('Invalid target pattern');
    }
    if (Object.prototype.hasOwnProperty.call(target, 'color') &&
        (typeof target.color !== 'string' || target.color.trim() === '' ||
         target.color.length > MAX_TARGET_COLOR_LENGTH || !ALLOWED_TARGET_COLORS.has(target.color))) {
      throw new Error('Invalid target color');
    }
  }

  if (data.settings !== undefined) {
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      throw new Error('Invalid settings');
    }
    validateAllowedProperties(data.settings, ALLOWED_SETTINGS_PROPERTIES, 'Invalid settings property');
    if (Object.values(data.settings).some(value => typeof value !== 'boolean')) {
      throw new Error('Invalid settings value');
    }
  }
}

/**
 * サイズ検証後にインポートテキストを JSON として解析する
 * @param {string} text - インポートする JSON テキスト
 * @returns {Object} 解析済みのインポートデータ
 * @throws {Error} 入力がサイズ上限を超えるか JSON として不正な場合
 */
export function parseImportText(text) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_DATA_SIZE) {
    throw new Error('Import data exceeds size limit');
  }
  return JSON.parse(text);
}

/**
 * データのインポート処理共通
 * @param {Object} data - インポートする JSON データ
 */
async function importData(data) {
  validateImportData(data);

  // 検証済みの許可プロパティだけから保存用データを再構築する。
  const importedTargets = data.targets.map(target => ({
    name: target.name,
    pattern: Array.isArray(target.pattern) ? [...target.pattern] : target.pattern,
    color: target.color ? getCompatibleColor(target.color) : 'grey'
  }));

  const importedSettings = { ...DEFAULT_SETTINGS };
  for (const key of ALLOWED_SETTINGS_PROPERTIES) {
    if (data.settings && Object.prototype.hasOwnProperty.call(data.settings, key)) {
      importedSettings[key] = data.settings[key];
    }
  }

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
 * テキストペーストモーダルの表示/非表示
 */
function showPasteImportModal() {
  if (pasteImportTextarea) pasteImportTextarea.value = '';
  if (pasteImportModalScrim) pasteImportModalScrim.style.display = 'flex';
}

function hidePasteImportModal() {
  if (pasteImportModalScrim) pasteImportModalScrim.style.display = 'none';
}

/**
 * 手動ペーストモーダルからのインポート実行
 */
async function handleConfirmPasteImport() {
  const text = pasteImportTextarea.value;
  if (!text) return;
  try {
    const data = parseImportText(text);
    await importData(data);
    hidePasteImportModal();
  } catch {
    showToast(chrome.i18n.getMessage('importError'));
  }
}

/**
 * クリップボードからのインポート
 * readText が使用できない、または権限エラーの場合手動ペーストダイアログを表示
 */
async function handlePasteImport() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      showPasteImportModal();
      return;
    }
    const text = await navigator.clipboard.readText();
    const data = parseImportText(text);
    await importData(data);
  } catch {
    // 権限不足や API 未サポート時は手動ペースト用ダイアログを表示
    showPasteImportModal();
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
  if (file.size > MAX_IMPORT_DATA_SIZE) {
    showToast(chrome.i18n.getMessage('importError'));
    fileInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = parseImportText(event.target.result);
      await importData(data);
    } catch {
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
