import { executeMagnet, getExportTimestamp, DEFAULT_SETTINGS } from './ui/utils.js';

// DOM elements
const targetListEl = document.getElementById('target-list');
const addNewBtn = document.getElementById('add-new-btn');
const addFromDomainBtn = document.getElementById('add-from-domain-btn');
const settingsBtn = document.getElementById('settings-btn');

// Target Modal elements
const targetModalScrim = document.getElementById('target-modal-scrim');
const modalTitleEl = document.getElementById('modal-title');
const newNameInput = document.getElementById('new-name');
const patternListContainer = document.getElementById('pattern-list-container');
const addPatternBtn = document.getElementById('add-pattern-btn');
const modalFeedbackEl = document.getElementById('modal-feedback');
const colorOptions = document.querySelectorAll('.color-option');
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
const discardTabsContainer = document.getElementById('discard-tabs-container');
const discardTabsSwitch = document.getElementById('discard-tabs-switch');
const closeDuplicateTabsSwitch = document.getElementById('close-duplicate-tabs-switch');
const keepTMOrderSwitch = document.getElementById('keep-tm-order-switch');
const copyExportBtn = document.getElementById('copy-export-btn');
const pasteImportBtn = document.getElementById('paste-import-btn');
const fileExportBtn = document.getElementById('file-export-btn');
const fileImportBtn = document.getElementById('file-import-btn');
const fileInput = document.getElementById('file-input');
const aboutVersionEl = document.getElementById('about-version');
const aboutDeveloperEl = document.getElementById('about-developer');
const aboutTargetCountEl = document.getElementById('about-target-count');

// Delete Dialog elements
const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
const confirmDeleteCancelBtn = document.getElementById('confirm-delete-cancel-btn');
const confirmDeleteOkBtn = document.getElementById('confirm-delete-ok-btn');

const toastEl = document.getElementById('toast');

// State
let targets = [];
let settings = { ...DEFAULT_SETTINGS };
let selectedColor = 'grey';
let currentEditIndex = null;
let currentDeleteIndex = null;

/**
 * HTMLの要素を翻訳する
 */
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const message = chrome.i18n.getMessage(el.dataset.i18n);
    if (message) {
      el.textContent = message;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const message = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (message) {
      el.placeholder = message;
    }
  });
}

/**
 * 初期化処理
 */
export async function init() {
  applyI18n();
  const data = await chrome.storage.local.get(['targets', 'settings']);
  targets = data.targets || [];
  settings = { ...settings, ...(data.settings || {}) };

  renderTargetList();
  renderSettings();
  setupEventListeners();
  updateDomainButtonState();

  // Aboutタブの情報を更新
  updateAboutInfo();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.targets) {
      const nextTargets = changes.targets.newValue || [];
      if (JSON.stringify(nextTargets) !== JSON.stringify(targets)) {
        targets = nextTargets;
        renderTargetList();
        updateAboutInfo();
      }
    }
    if (changes.settings) {
      const nextSettings = changes.settings.newValue || {};
      if (JSON.stringify(nextSettings) !== JSON.stringify(settings)) {
        settings = { ...settings, ...nextSettings };
        renderSettings();
      }
    }
  });

  chrome.tabs.onActivated.addListener(updateDomainButtonState);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      updateDomainButtonState();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

/**
 * 設定値をUIに反映する
 */
export function renderSettings() {
  collectAllGroupsSwitch.checked = !!settings.collectFromAllGroups;
  collapseAfterCollectSwitch.checked = !!settings.collapseAfterCollect;
  discardTabsSwitch.checked = !!settings.discardTabsAfterCollect;
  closeDuplicateTabsSwitch.checked = !!settings.closeDuplicateTabs;
  keepTMOrderSwitch.checked = !!settings.keepTMOrder;

  if (settings.collapseAfterCollect) {
    discardTabsContainer.classList.remove('disabled');
    discardTabsSwitch.disabled = false;
  } else {
    discardTabsContainer.classList.add('disabled');
    discardTabsSwitch.disabled = true;
  }
}

/**
 * ターゲットリストをレンダリングする
 */
export function renderTargetList() {
  targetListEl.innerHTML = '';
  if (targets.length === 0) {
    targetListEl.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-medium);">${chrome.i18n.getMessage('noTargets')}</div>`;
    return;
  }

  const labelExecute = chrome.i18n.getMessage('summonMagnet');

  targets.forEach((target, index) => {
    const item = document.createElement('div');
    item.className = 'target-list-item';
    item.draggable = true;
    item.dataset.index = index;

    const colorClass = `bg-${target.color || 'grey'}`;

    item.innerHTML = `
      <div class="drag-handle">
        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" style="fill: currentColor;"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
      </div>
      <div class="target-info">
        <div class="target-color-chip ${colorClass}"></div>
        <div class="target-name">${escapeHtml(target.name)}</div>
      </div>
      <div class="target-actions">
        <button class="icon-button execute-btn" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
            <path d="M5 2h4v3H5V2zm10 0h4v3h-4V2zM5 6v8c0 3.87 3.13 7 7 7s7-3.13 7-7V6h-4v8c0 1.66-1.34 3-3 3s-3-1.34-3-3V6H5z"/>
          </svg>
          <span class="tooltip">${labelExecute}</span>
        </button>
      </div>
    `;

    // ドラッグ＆ドロップイベント
    item.addEventListener('dragstart', () => item.classList.add('dragging'));
    item.addEventListener('dragend', () => item.classList.remove('dragging'));

    // 項目クリック（編集）
    item.addEventListener('click', (e) => {
      if (e.target.closest('.drag-handle') || e.target.closest('.execute-btn')) return;
      showModal(index);
    });

    targetListEl.appendChild(item);
  });
}

/**
 * リストの並べ替え（メインリスト）
 */
targetListEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  const draggingItem = document.querySelector('.target-list-item.dragging');
  if (!draggingItem) return;

  const siblings = [...targetListEl.querySelectorAll('.target-list-item:not(.dragging)')];
  const nextSibling = siblings.find(sibling => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  targetListEl.insertBefore(draggingItem, nextSibling);
});

targetListEl.addEventListener('drop', async (e) => {
  e.preventDefault();
  const items = [...targetListEl.querySelectorAll('.target-list-item')];
  const newTargets = items.map(item => targets[parseInt(item.dataset.index)]);
  targets = newTargets;
  await chrome.storage.local.set({ targets });
  renderTargetList();
});

/**
 * ブラウザの特殊ページかどうかを判定
 */
export function isSpecialPage(url) {
  if (!url) return true;
  return !url.startsWith('http://') && !url.startsWith('https://');
}

/**
 * トーストを表示
 */
let toastTimeout = null;
export function showToast(message) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
    toastTimeout = null;
  }, 3000);
}

/**
 * ドメインボタンの活性状態を更新
 */
export async function updateDomainButtonState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || isSpecialPage(tab.url)) {
    addFromDomainBtn.classList.add('disabled');
  } else {
    addFromDomainBtn.classList.remove('disabled');
  }
}

/**
 * フィードバックメッセージを表示
 */
export function showModalFeedback(message) {
  modalFeedbackEl.textContent = message;
  modalFeedbackEl.classList.remove('hidden');
}

export function hideModalFeedback() {
  modalFeedbackEl.classList.add('hidden');
  modalFeedbackEl.textContent = '';
}

/**
 * イベントリスナーの設定
 */
export function setupEventListeners() {
  // 実行ボタン
  targetListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.execute-btn');
    if (!btn) return;
    const index = parseInt(btn.dataset.index);
    handleExecuteMagnet(targets[index]);
  });

  // フッターボタン
  addNewBtn.addEventListener('click', () => showModal());
  addFromDomainBtn.addEventListener('click', handleAddFromDomain);

  // ターゲットモーダル
  addPatternBtn.addEventListener('click', () => {
    addPatternInput();
    hideModalFeedback();
  });
  cancelTargetBtn.addEventListener('click', hideModal);
  saveTargetBtn.addEventListener('click', handleSaveTarget);
  deleteTargetBtn.addEventListener('click', () => showDeleteDialog(currentEditIndex));

  newNameInput.addEventListener('input', hideModalFeedback);

  colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectColor(opt.dataset.color);
      hideModalFeedback();
    });
  });

  // 設定モーダル
  collectAllGroupsSwitch.addEventListener('change', async () => {
    settings.collectFromAllGroups = collectAllGroupsSwitch.checked;
    await chrome.storage.local.set({ settings });
  });

  collapseAfterCollectSwitch.addEventListener('change', async () => {
    settings.collapseAfterCollect = collapseAfterCollectSwitch.checked;
    await chrome.storage.local.set({ settings });
    renderSettings();
  });

  discardTabsSwitch.addEventListener('change', async () => {
    settings.discardTabsAfterCollect = discardTabsSwitch.checked;
    await chrome.storage.local.set({ settings });
  });

  closeDuplicateTabsSwitch.addEventListener('change', async () => {
    settings.closeDuplicateTabs = closeDuplicateTabsSwitch.checked;
    await chrome.storage.local.set({ settings });
  });

  keepTMOrderSwitch.addEventListener('change', async () => {
    settings.keepTMOrder = keepTMOrderSwitch.checked;
    await chrome.storage.local.set({ settings });
  });

  settingsBtn.addEventListener('click', showSettingsModal);
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

  // 外側クリックで閉じる
  [targetModalScrim, settingsModalScrim, deleteDialogScrim].forEach(scrim => {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) {
        if (scrim === targetModalScrim) hideModal();
        if (scrim === settingsModalScrim) hideSettingsModal();
        if (scrim === deleteDialogScrim) hideDeleteDialog();
      }
    });
  });
}

/**
 * About情報を更新
 */
export function updateAboutInfo() {
  const manifest = chrome.runtime.getManifest();
  aboutVersionEl.textContent = `v${manifest.version}`;
  aboutDeveloperEl.textContent = manifest.author || 'Masanori SATAKE';
  aboutTargetCountEl.textContent = targets.length;
}

/**
 * ターゲットモーダルを表示
 */
export function showModal(index = null) {
  currentEditIndex = index;
  patternListContainer.innerHTML = '';
  hideModalFeedback();

  if (index !== null) {
    const target = targets[index];
    modalTitleEl.textContent = chrome.i18n.getMessage('edit');
    newNameInput.value = target.name;
    const patterns = Array.isArray(target.pattern) ? target.pattern : [target.pattern];
    patterns.forEach(p => addPatternInput(p));
    selectColor(target.color || 'grey');
    deleteTargetBtn.classList.remove('hidden');
  } else {
    modalTitleEl.textContent = chrome.i18n.getMessage('addNew');
    newNameInput.value = '';
    addPatternInput();
    selectColor('grey');
    deleteTargetBtn.classList.add('hidden');
  }
  targetModalScrim.style.display = 'flex';
}

export function hideModal() {
  targetModalScrim.style.display = 'none';
  currentEditIndex = null;
}

/**
 * パターン入力欄を追加
 */
export function addPatternInput(value = '') {
  const item = document.createElement('div');
  item.className = 'pattern-item';
  item.draggable = true;

  const placeholder = chrome.i18n.getMessage('placeholderUrlPattern');
  item.innerHTML = `
    <div class="drag-handle">
      <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" style="fill: currentColor;"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
    </div>
    <input type="text" class="pattern-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" required>
    <button class="icon-button delete-pattern-btn">
      <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
    </button>
  `;

  item.querySelector('.delete-pattern-btn').addEventListener('click', () => {
    if (patternListContainer.children.length > 1) {
      item.remove();
    } else {
      item.querySelector('input').value = '';
    }
    hideModalFeedback();
  });

  item.querySelector('.pattern-input').addEventListener('input', hideModalFeedback);

  item.addEventListener('dragstart', () => item.classList.add('dragging'));
  item.addEventListener('dragend', () => item.classList.remove('dragging'));

  patternListContainer.appendChild(item);
  applyI18n();
}

/**
 * パターンの並べ替え
 */
patternListContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  const draggingItem = patternListContainer.querySelector('.dragging');
  if (!draggingItem) return;
  const siblings = [...patternListContainer.querySelectorAll('.pattern-item:not(.dragging)')];
  const nextSibling = siblings.find(sibling => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  patternListContainer.insertBefore(draggingItem, nextSibling);
});

/**
 * カラー選択
 */
export function selectColor(color) {
  selectedColor = color;
  colorOptions.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.color === color);
  });
}

/**
 * ターゲット保存
 */
export async function handleSaveTarget() {
  const name = newNameInput.value.trim();
  const rawPatterns = [...patternListContainer.querySelectorAll('.pattern-input')]
    .map(input => input.value.trim())
    .filter(val => val !== '');

  if (!name || rawPatterns.length === 0) {
    showModalFeedback(chrome.i18n.getMessage('errorInputRequired'));
    return;
  }

  // プロトコル除去と特殊ページチェック
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

  const targetData = { name, pattern: patterns, color: selectedColor };
  if (currentEditIndex !== null) {
    targets[currentEditIndex] = targetData;
  } else {
    targets.push(targetData);
  }

  await chrome.storage.local.set({ targets });
  renderTargetList();
  hideModal();
}

/**
 * ドメインから追加
 */
export async function handleAddFromDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || isSpecialPage(tab.url)) {
    if (tab && isSpecialPage(tab.url)) {
      showToast(chrome.i18n.getMessage('errorSpecialPage'));
    }
    return;
  }
  try {
    const url = new URL(tab.url);
    let domain = url.hostname;
    const parts = domain.split('.');

    // 一般的な文字列をスキップ
    const skipList = ['www', 'mail', 'app', 'blog'];
    let mainPart = parts[0];
    if (parts.length > 2 && skipList.includes(parts[0].toLowerCase())) {
      mainPart = parts[1];
    }

    const name = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    const pattern = domain + '/*';
    showModal();
    newNameInput.value = name;
    patternListContainer.innerHTML = '';
    addPatternInput(pattern);
  } catch (e) {
    console.error('Failed to parse current URL:', e);
  }
}

/**
 * 設定モーダル
 */
export function showSettingsModal() {
  settingsModalScrim.style.display = 'flex';
  updateAboutInfo();
}

export function hideSettingsModal() {
  settingsModalScrim.style.display = 'none';
}

/**
 * エクスポート（コピー）
 */
export async function handleCopyExport() {
  try {
    const exportData = {
      targets: targets,
      settings: settings
    };
    const json = JSON.stringify(exportData, null, 2);
    await navigator.clipboard.writeText(json);
    showToast(chrome.i18n.getMessage('copied'));
  } catch (err) {
    console.error('Failed to copy targets:', err);
  }
}

/**
 * インポート（貼り付け）
 */
export async function handlePasteImport() {
  try {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text);
    await importData(data);
  } catch (err) {
    showToast(chrome.i18n.getMessage('importError'));
  }
}

/**
 * エクスポート（ファイル）
 */
export function handleFileExport() {
  const exportData = {
    targets: targets,
    settings: settings
  };
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
 * インポート（ファイル）
 */
export function handleFileImport(e) {
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
 * データのインポート
 */
export async function importData(data) {
  let importedTargets = [];
  let importedSettings = { ...DEFAULT_SETTINGS };

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    importedTargets = Array.isArray(data.targets) ? data.targets : [];
    importedSettings = { ...importedSettings, ...(data.settings || {}) };
  } else {
    throw new Error('Invalid format');
  }

  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  if (mode === 'append') {
    targets = [...targets, ...importedTargets];
    // append mode should not overwrite current common settings.
  } else {
    targets = importedTargets;
    settings = importedSettings;
  }

  await chrome.storage.local.set({ targets, settings });
  renderTargetList();
  renderSettings();
  showToast(chrome.i18n.getMessage('importSuccess'));
}

/**
 * 削除確認
 */
export function showDeleteDialog(index) {
  currentDeleteIndex = index;
  deleteDialogScrim.style.display = 'flex';
}

export function hideDeleteDialog() {
  deleteDialogScrim.style.display = 'none';
  currentDeleteIndex = null;
}

export async function handleConfirmDelete() {
  if (currentDeleteIndex !== null) {
    targets.splice(currentDeleteIndex, 1);
    await chrome.storage.local.set({ targets });
    renderTargetList();
  }
  hideDeleteDialog();
  hideModal();
}

/**
 * 磁石実行
 */
export async function handleExecuteMagnet(target) {
  try {
    await executeMagnet(target);
  } catch (e) {
    console.error('Magnet execution failed:', e);
    showToast(chrome.i18n.getMessage('errorExecutionFailed'));
  }
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
