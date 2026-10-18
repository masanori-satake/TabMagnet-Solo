/**
 * TabMagnet-Solo Sidepanel エントリポイント
 * 各モジュールを調整し、UIの初期化とイベント設定を行う
 */

import { state, loadState, saveGroupSets, saveSettings, syncDataToCloud } from './ui/state.js';
import { applyI18n } from './ui/i18n.js';
import { showToast } from './ui/toast.js';
import { renderTargetList, handleDragOver, handleDrop, setOnCrossSetDropCallback } from './ui/list-renderer.js';
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
  showGroupSetEditMenu,
  hideGroupSetEditMenu,
  showGroupSetModal,
  hideGroupSetModal,
  moveGroupSet,
  deleteGroupSet,
  addGroupSet,
  saveGroupSet,
  setRenderCallback
} from './ui/group-set.js';
import {
  getExportTimestamp,
  DEFAULT_SETTINGS,
  isSpecialPage,
  getCompatibleColor,
  isEdge,
  validateImportData,
  validateSingleTarget,
  normalizeGroupSets,
  createDefaultGroupSet,
  migrateTargetsToGroupSets
} from './ui/utils.js';
import { MAX_GROUP_SETS, MAX_GROUPS_PER_SET } from './ui/constants.js';

export { validateImportData };

// JSON 解析前に巨大な入力を拒否し、メモリの過剰消費を防ぐ。
export const MAX_IMPORT_DATA_SIZE = 1024 * 1024;
const ALLOWED_SETTINGS_PROPERTIES = new Set(Object.keys(DEFAULT_SETTINGS));

// DOM elements
const targetListEl = document.getElementById('target-list');
const addGroupSetBtn = document.getElementById('add-group-set-btn');
const settingsBtn = document.getElementById('settings-btn');

// Group-Set Edit Menu elements
const gsEditMenuScrim = document.getElementById('gs-edit-menu-scrim');
const gsEditMenuAddGroup = document.getElementById('gs-edit-menu-add-group');
const gsEditMenuAddFromDomain = document.getElementById('gs-edit-menu-add-from-domain');
const gsEditMenuEditSet = document.getElementById('gs-edit-menu-edit-set');
const gsEditMenuMoveUp = document.getElementById('gs-edit-menu-move-up');
const gsEditMenuMoveDown = document.getElementById('gs-edit-menu-move-down');
const cancelGsEditMenuBtn = document.getElementById('cancel-gs-edit-menu-btn');

// Group-Set Edit Modal elements
const gsEditModalScrim = document.getElementById('gs-edit-modal-scrim');
const deleteGroupSetBtn = document.getElementById('delete-group-set-btn');
const cancelGroupSetBtn = document.getElementById('cancel-group-set-btn');
const saveGroupSetBtn = document.getElementById('save-group-set-btn');

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

// Move/Copy Modal elements
const moveCopyDialogScrim = document.getElementById('move-copy-dialog-scrim');
const moveCopyDialogText = document.getElementById('move-copy-dialog-text');
const moveCopyCancelBtn = document.getElementById('move-copy-cancel-btn');
const moveCopyMoveBtn = document.getElementById('move-copy-move-btn');
const moveCopyDuplicateBtn = document.getElementById('move-copy-duplicate-btn');

let pendingCrossSetMove = null;

/**
 * リストと関連UIの再描画を行う
 */
function renderUI() {
  renderTargetList(handleEditGroup, handleEditGroupSet);
  updateFooterButtonState();
  updateAboutInfo();
}

/**
 * Group編集要求ハンドラ
 */
function handleEditGroup(groupIndex, setIndex) {
  showTargetModal(groupIndex, setIndex);
}

/**
 * Group-Set編集要求ハンドラ
 */
function handleEditGroupSet(setIndex) {
  showGroupSetEditMenu(setIndex);
}

/**
 * フッターボタンの活性状態を更新
 */
function updateFooterButtonState() {
  if (addGroupSetBtn) {
    const isFull = state.groupSets.length >= MAX_GROUP_SETS;
    addGroupSetBtn.disabled = isFull;
    addGroupSetBtn.classList.toggle('disabled', isFull);
  }
}

/**
 * 初期化処理
 */
export async function init() {
  if (isEdge()) {
    document.body.classList.add('edge-mode');
  }
  applyI18n();
  await loadState();

  setRenderCallback(renderUI);
  renderUI();
  renderSettingsUI();
  setupEventListeners();

  // ストレージの変更を監視
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local') {
      if (changes.groupSets) {
        const nextSets = normalizeGroupSets(changes.groupSets.newValue || []);
        if (JSON.stringify(nextSets) !== JSON.stringify(state.groupSets)) {
          state.groupSets = nextSets;
          if (pendingCrossSetMove) {
            hideMoveCopyDialog();
          } else {
            renderUI();
          }
        }
      } else if (changes.targets && changes.targets.newValue !== undefined) {
        const nextTargets = changes.targets.newValue || [];
        const nextSets = [migrateTargetsToGroupSets(nextTargets)];
        if (JSON.stringify(nextSets) !== JSON.stringify(state.groupSets)) {
          state.groupSets = nextSets;
          if (pendingCrossSetMove) {
            hideMoveCopyDialog();
          } else {
            renderUI();
          }
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
      try {
        const syncData = {};
        if (changes.groupSets) syncData.groupSets = changes.groupSets.newValue;
        if (changes.targets) syncData.targets = changes.targets.newValue;
        if (changes.settings) syncData.settings = changes.settings.newValue;
        validateImportData(syncData);
      } catch (e) {
        console.warn('Invalid sync data received in sidepanel:', e);
        return;
      }
      if (changes.groupSets && changes.groupSets.newValue) {
        const nextSets = normalizeGroupSets(changes.groupSets.newValue);
        state.groupSets = nextSets;
        const saving = chrome.storage.local.set({ groupSets: nextSets });
        // 保存完了を待つ間に、更新前のインデックスで確定されるのを防ぐ。
        if (pendingCrossSetMove) {
          hideMoveCopyDialog();
        } else {
          saving.then(() => {
            renderUI();
          });
        }
      } else if (!changes.groupSets && changes.targets && changes.targets.newValue) {
        // 旧端末からの更新で、すでに同期済みの新形式を上書きしない。
        const sync = await chrome.storage.sync.get(['groupSets']);
        if (sync.groupSets === undefined) {
          const nextSets = [migrateTargetsToGroupSets(changes.targets.newValue)];
          state.groupSets = nextSets;
          const saving = chrome.storage.local.set({ groupSets: nextSets });
          if (pendingCrossSetMove) {
            hideMoveCopyDialog();
          } else {
            saving.then(() => {
              renderUI();
            });
          }
        }
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
}

document.addEventListener('DOMContentLoaded', init);

/**
 * 各種イベントリスナーの設定
 */
function setupEventListeners() {
  // メインリスト
  if (targetListEl) {
    targetListEl.addEventListener('dragover', handleDragOver);
    targetListEl.addEventListener('drop', handleDrop);
  }

  setOnCrossSetDropCallback(handleCrossSetDrop);

  // フッターボタン
  if (addGroupSetBtn) {
    addGroupSetBtn.addEventListener('click', addGroupSet);
  }
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettingsModal);
  }

  // Group-Set 編集メニュー
  if (gsEditMenuAddGroup) {
    gsEditMenuAddGroup.addEventListener('click', () => {
      const setIndex = state.currentEditSetIndex ?? 0;
      hideGroupSetEditMenu();
      showTargetModal(null, setIndex);
    });
  }
  if (gsEditMenuAddFromDomain) {
    gsEditMenuAddFromDomain.addEventListener('click', () => {
      const setIndex = state.currentEditSetIndex ?? 0;
      hideGroupSetEditMenu();
      handleAddFromDomain(setIndex);
    });
  }
  if (gsEditMenuEditSet) {
    gsEditMenuEditSet.addEventListener('click', () => {
      const setIndex = state.currentEditSetIndex ?? 0;
      hideGroupSetEditMenu();
      showGroupSetModal(setIndex);
    });
  }
  if (gsEditMenuMoveUp) {
    gsEditMenuMoveUp.addEventListener('click', () => {
      const setIndex = state.currentEditSetIndex ?? 0;
      moveGroupSet(setIndex, -1);
    });
  }
  if (gsEditMenuMoveDown) {
    gsEditMenuMoveDown.addEventListener('click', () => {
      const setIndex = state.currentEditSetIndex ?? 0;
      moveGroupSet(setIndex, 1);
    });
  }
  if (cancelGsEditMenuBtn) {
    cancelGsEditMenuBtn.addEventListener('click', hideGroupSetEditMenu);
  }

  // Group-Set 編集モーダル
  if (deleteGroupSetBtn) {
    deleteGroupSetBtn.addEventListener('click', () => {
      deleteGroupSet(state.currentEditSetIndex);
    });
  }
  if (cancelGroupSetBtn) {
    cancelGroupSetBtn.addEventListener('click', hideGroupSetModal);
  }
  if (saveGroupSetBtn) {
    saveGroupSetBtn.addEventListener('click', () => {
      saveGroupSet(state.currentEditSetIndex);
    });
  }

  // Group（ターゲット）モーダル
  if (addPatternBtn) {
    addPatternBtn.addEventListener('click', () => {
      addPatternInput();
      hideModalFeedback();
    });
  }
  if (cancelTargetBtn) {
    cancelTargetBtn.addEventListener('click', hideTargetModal);
  }
  if (saveTargetBtn) {
    saveTargetBtn.addEventListener('click', handleSaveTarget);
  }
  if (deleteTargetBtn) {
    deleteTargetBtn.addEventListener('click', () => {
      const setIndex = state.currentEdit ? state.currentEdit.setIndex ?? 0 : 0;
      const groupIndex = state.currentEdit ? state.currentEdit.groupIndex : null;
      showDeleteDialog({ type: 'group', setIndex, groupIndex });
    });
  }

  if (newNameInput) {
    newNameInput.addEventListener('input', hideModalFeedback);
  }

  if (patternListContainer) {
    patternListContainer.addEventListener('dragover', handlePatternDragOver);
  }

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

  const tabList = [...tabItems];
  tabItems.forEach((tab, index) => {
    const activateTab = () => {
      const targetTab = tab.dataset.tab;
      tabItems.forEach(t => {
        const isActive = t.dataset.tab === targetTab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        t.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      tabPanes.forEach(p => p.classList.toggle('hidden', p.id !== `tab-content-${targetTab}`));
    };

    tab.addEventListener('click', activateTab);

    tab.addEventListener('keydown', (e) => {
      let nextIndex = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabList.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabList.length) % tabList.length;
      }
      if (nextIndex !== null) {
        e.preventDefault();
        tabList[nextIndex].focus();
        tabList[nextIndex].click();
      }
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

  // 移動・複製ダイアログ
  if (moveCopyCancelBtn) moveCopyCancelBtn.addEventListener('click', hideMoveCopyDialog);
  if (moveCopyMoveBtn) moveCopyMoveBtn.addEventListener('click', handleConfirmMoveGroup);
  if (moveCopyDuplicateBtn) moveCopyDuplicateBtn.addEventListener('click', handleConfirmDuplicateGroup);

  // モーダル外側クリック
  [targetModalScrim, settingsModalScrim, deleteDialogScrim, pasteImportModalScrim, syncModalScrim, gsEditMenuScrim, gsEditModalScrim, moveCopyDialogScrim].forEach(scrim => {
    if (!scrim) return;
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) {
        if (scrim === targetModalScrim) hideTargetModal();
        if (scrim === settingsModalScrim) hideSettingsModal();
        if (scrim === deleteDialogScrim) hideDeleteDialog();
        if (scrim === pasteImportModalScrim) hidePasteImportModal();
        if (scrim === syncModalScrim) handleCancelSync();
        if (scrim === gsEditMenuScrim) hideGroupSetEditMenu();
        if (scrim === gsEditModalScrim) hideGroupSetModal();
        if (scrim === moveCopyDialogScrim) hideMoveCopyDialog();
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
    const syncData = await chrome.storage.sync.get(['settings', 'groupSets', 'targets']);
    validateImportData(syncData);

    // 1. 設定項目の同期処理
    let finalSettings = { ...state.settings, syncEnabled: true };
    if (selectedSettings === 'from_sync') {
      if (syncData.settings) {
        finalSettings = { ...DEFAULT_SETTINGS, ...syncData.settings, syncEnabled: true };
      }
    }

    // 2. タブグループセットの同期処理
    let finalGroupSets = [...state.groupSets];
    if (selectedTargets === 'from_sync') {
      if (syncData.groupSets) {
        finalGroupSets = syncData.groupSets;
      } else if (syncData.targets) {
        finalGroupSets = [migrateTargetsToGroupSets(syncData.targets)];
      }
    }
    finalGroupSets = normalizeGroupSets(finalGroupSets);

    // 容量検査に成功したデータだけで同期を確定し、重複した書き込みを避ける。
    const synced = await syncDataToCloud({
      settings: finalSettings,
      groupSets: finalGroupSets
    });
    if (!synced) return;
    await saveSettings(finalSettings, { sync: false });
    await saveGroupSets(finalGroupSets, { sync: false });

    renderSettingsUI();
    renderUI();
    hideSyncModal();
  } catch (e) {
    console.error('Failed to initialize sync:', e);
    handleCancelSync();
  }
}

/**
 * Group（ターゲット）の保存処理
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

  if (name.length > 100 || rawPatterns.length > 50 || rawPatterns.some(p => p.length > 500)) {
    showModalFeedback(chrome.i18n.getMessage('errorInputRequired'));
    return;
  }

  const setIndex = state.currentEdit ? state.currentEdit.setIndex ?? 0 : 0;
  const groupIndex = state.currentEdit ? state.currentEdit.groupIndex : null;

  if (!state.groupSets[setIndex]) return;

  if (groupIndex === null && (state.groupSets[setIndex].groups || []).length >= MAX_GROUPS_PER_SET) {
    showModalFeedback(chrome.i18n.getMessage('errorGroupLimit', [String(MAX_GROUPS_PER_SET)]));
    return;
  }

  const patterns = rawPatterns.map(p => /^https?:\/\//i.test(p) ? p.replace(/^https?:\/\//i, '') : p);
  const targetData = { name, pattern: patterns, color: state.selectedColor };

  // セキュリティ向上: 中央集権的な入力検証で非http(s)スキームや不正データを排除する
  try {
    validateSingleTarget(targetData);
  } catch {
    showModalFeedback(chrome.i18n.getMessage('warningSpecialPageIncluded'));
    return;
  }

  if (groupIndex !== null) {
    state.groupSets[setIndex].groups[groupIndex] = targetData;
  } else {
    if (!state.groupSets[setIndex].groups) {
      state.groupSets[setIndex].groups = [];
    }
    state.groupSets[setIndex].groups.push(targetData);
  }

  await saveGroupSets(state.groupSets);
  renderUI();
  hideTargetModal();
}

/**
 * 現在のタブドメインからGroupを自動生成しGroupモーダルに設定する
 * @param {number} [setIndex] - 追加先のGroup-Setインデックス
 */
async function handleAddFromDomain(setIndex = 0) {
  const targetSetIndex = typeof setIndex === 'number' ? setIndex : 0;
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

    showTargetModal(null, targetSetIndex);
    newNameInput.value = name;
    patternListContainer.innerHTML = '';
    addPatternInput(pattern);
  } catch (e) {
    console.error('Failed to parse current URL:', e);
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

  let importedGroupSets = [];
  if (Array.isArray(data.groupSets)) {
    importedGroupSets = normalizeGroupSets(data.groupSets);
  } else if (Array.isArray(data.targets)) {
    importedGroupSets = [migrateTargetsToGroupSets(data.targets)];
  } else {
    throw new Error('Invalid import data: groupSets or targets must be an array');
  }

  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  const nextGroupSets = mode === 'append'
    ? [...state.groupSets, ...importedGroupSets]
    : importedGroupSets;
  if (nextGroupSets.length > MAX_GROUP_SETS) {
    throw new Error('Invalid import data: groupSets array exceeds limit');
  }

  const importedSettings = mode === 'append'
    ? { ...state.settings }
    : { ...DEFAULT_SETTINGS, syncEnabled: state.settings.syncEnabled };

  for (const key of ALLOWED_SETTINGS_PROPERTIES) {
    if (key === 'syncEnabled') continue;
    if (data.settings && Object.prototype.hasOwnProperty.call(data.settings, key)) {
      importedSettings[key] = data.settings[key];
    }
  }

  const synced = await saveGroupSets(nextGroupSets);
  await saveSettings(importedSettings);

  renderUI();
  renderSettingsUI();
  // 容量超過の通知を成功メッセージで即座に消さない。
  if (synced) showToast(chrome.i18n.getMessage('importSuccess'));
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
    showPasteImportModal();
  }
}

/**
 * クリップボードへのエクスポート
 */
async function handleCopyExport() {
  try {
    const exportSettings = { ...state.settings, syncEnabled: false };
    const exportData = { groupSets: state.groupSets, settings: exportSettings };
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
  const exportSettings = { ...state.settings, syncEnabled: false };
  const exportData = { groupSets: state.groupSets, settings: exportSettings };
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
  if (state.currentDelete) {
    const { type, setIndex, groupIndex } = state.currentDelete;
    if (type === 'groupSet' && typeof setIndex === 'number' && state.groupSets.length >= 2) {
      state.groupSets.splice(setIndex, 1);
      await saveGroupSets(state.groupSets);
      hideGroupSetModal();
    } else if (type === 'group' && typeof setIndex === 'number' && typeof groupIndex === 'number' && state.groupSets[setIndex]) {
      state.groupSets[setIndex].groups.splice(groupIndex, 1);
      await saveGroupSets(state.groupSets);
    }
    renderUI();
  }
  hideDeleteDialog();
  hideTargetModal();
}

/**
 * グループセット間ドロップ時のポップアップ表示
 * @param {Object} info - { sourceSetIndex, sourceGroupIndex, targetSetIndex, targetGroupIndex }
 */
function handleCrossSetDrop(info) {
  const sourceSet = state.groupSets[info.sourceSetIndex];
  const targetSet = state.groupSets[info.targetSetIndex];
  if (!sourceSet || !targetSet) return;

  const group = (sourceSet.groups || [])[info.sourceGroupIndex];
  if (!group) return;

  pendingCrossSetMove = info;

  if (moveCopyDialogText) {
    const textPattern = chrome.i18n.getMessage('moveCopyModalText', [group.name || '', targetSet.name || '']) ||
      `「${group.name || ''}」を「${targetSet.name || ''}」へ移動または複製しますか？`;
    moveCopyDialogText.textContent = textPattern;
  }

  if (moveCopyDialogScrim) {
    moveCopyDialogScrim.style.display = 'flex';
  }
}

/**
 * 移動・複製ダイアログを閉じる
 */
function hideMoveCopyDialog() {
  if (moveCopyDialogScrim) {
    moveCopyDialogScrim.style.display = 'none';
  }
  pendingCrossSetMove = null;
  renderUI();
}

/**
 * グループの移動を確定実行
 */
async function handleConfirmMoveGroup() {
  if (!pendingCrossSetMove) return;
  const { sourceSetIndex, sourceGroupIndex, targetSetIndex, targetGroupIndex } = pendingCrossSetMove;
  // 保存待ち中の連続クリックでも、同じ保留操作は一度だけ実行する。
  pendingCrossSetMove = null;

  const sourceSet = state.groupSets[sourceSetIndex];
  const targetSet = state.groupSets[targetSetIndex];
  if (!sourceSet || !targetSet) {
    hideMoveCopyDialog();
    return;
  }

  if ((targetSet.groups || []).length >= MAX_GROUPS_PER_SET) {
    showToast(chrome.i18n.getMessage('errorGroupLimit', [String(MAX_GROUPS_PER_SET)]));
    hideMoveCopyDialog();
    return;
  }

  const [group] = sourceSet.groups.splice(sourceGroupIndex, 1);
  if (!targetSet.groups) targetSet.groups = [];

  const insertIndex = Math.min(targetGroupIndex, targetSet.groups.length);
  targetSet.groups.splice(insertIndex, 0, group);

  await saveGroupSets(state.groupSets);
  hideMoveCopyDialog();
}

/**
 * グループの複製を確定実行
 */
async function handleConfirmDuplicateGroup() {
  if (!pendingCrossSetMove) return;
  const { sourceSetIndex, sourceGroupIndex, targetSetIndex, targetGroupIndex } = pendingCrossSetMove;
  // 保存待ち中の連続クリックでも、同じ保留操作は一度だけ実行する。
  pendingCrossSetMove = null;

  const sourceSet = state.groupSets[sourceSetIndex];
  const targetSet = state.groupSets[targetSetIndex];
  if (!sourceSet || !targetSet) {
    hideMoveCopyDialog();
    return;
  }

  if ((targetSet.groups || []).length >= MAX_GROUPS_PER_SET) {
    showToast(chrome.i18n.getMessage('errorGroupLimit', [String(MAX_GROUPS_PER_SET)]));
    hideMoveCopyDialog();
    return;
  }

  const originalGroup = sourceSet.groups[sourceGroupIndex];
  if (!originalGroup) {
    hideMoveCopyDialog();
    return;
  }

  const duplicatedGroup = JSON.parse(JSON.stringify(originalGroup));
  if (!targetSet.groups) targetSet.groups = [];

  const insertIndex = Math.min(targetGroupIndex, targetSet.groups.length);
  targetSet.groups.splice(insertIndex, 0, duplicatedGroup);

  await saveGroupSets(state.groupSets);
  hideMoveCopyDialog();
}
