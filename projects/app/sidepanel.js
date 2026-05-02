import { matchUrl, executeMagnet } from './ui/utils.js';

// DOM elements
const targetListEl = document.getElementById('target-list');
const addCurrentTabBtn = document.getElementById('add-current-tab');
const showAddFormBtn = document.getElementById('show-add-form');
const addFormEl = document.getElementById('add-form');
const newNameInput = document.getElementById('new-name');
const newPatternInput = document.getElementById('new-pattern');
const saveTargetBtn = document.getElementById('save-target');
const cancelAddBtn = document.getElementById('cancel-add');
const protectedGroupsInput = document.getElementById('protected-groups');
const saveSettingsBtn = document.getElementById('save-settings');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');

// State
let targets = [];
let protectedGroups = [];

/**
 * HTMLの要素を翻訳する
 */
function applyI18n() {
  // テキストコンテンツの翻訳
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const message = chrome.i18n.getMessage(el.dataset.i18n);
    if (message) {
      el.textContent = message;
    }
  });

  // プレースホルダーの翻訳
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
async function init() {
  applyI18n();
  const data = await chrome.storage.local.get(['targets', 'protectedGroups']);
  targets = data.targets || [];
  protectedGroups = data.protectedGroups || [];

  protectedGroupsInput.value = protectedGroups.join(', ');
  renderTargetList();
  setupEventListeners();

  // ストレージ変更を監視してUIを同期
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.targets) {
      const nextTargets = changes.targets.newValue || [];
      // 内容が実質的に異なる場合のみ更新
      if (JSON.stringify(nextTargets) !== JSON.stringify(targets)) {
        targets = nextTargets;
        renderTargetList();
      }
    }

    if (changes.protectedGroups) {
      const nextProtected = changes.protectedGroups.newValue || [];
      // ユーザーが入力中の場合は同期をスキップして入力を妨げない
      if (document.activeElement !== protectedGroupsInput &&
          JSON.stringify(nextProtected) !== JSON.stringify(protectedGroups)) {
        protectedGroups = nextProtected;
        protectedGroupsInput.value = protectedGroups.join(', ');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

/**
 * ターゲットリストをレンダリングする
 */
function renderTargetList() {
  targetListEl.innerHTML = '';
  if (targets.length === 0) {
    targetListEl.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">${chrome.i18n.getMessage('noTargets')}</div>`;
    return;
  }

  // ループ内でのgetMessage呼び出しを最小限にするための定数
  const labelSummon = chrome.i18n.getMessage('summonMagnet');
  const labelEdit = chrome.i18n.getMessage('edit');
  const labelDelete = chrome.i18n.getMessage('delete');

  targets.forEach((target, index) => {
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `
      <div class="target-header">
        <div class="target-name">${escapeHtml(target.name)}</div>
        <button class="btn-primary magnet-btn" data-index="${index}">${labelSummon}</button>
      </div>
      <div class="target-pattern">${escapeHtml(target.pattern)}</div>
      <div class="actions">
        <button class="btn-text edit-btn" data-index="${index}">${labelEdit}</button>
        <button class="btn-text btn-error delete-btn" data-index="${index}">${labelDelete}</button>
      </div>
    `;
    targetListEl.appendChild(item);
  });
}

/**
 * イベントリスナーの設定（イベント委譲を利用）
 */
function setupEventListeners() {
  targetListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const index = btn.dataset.index;
    if (index === undefined) return;

    if (btn.classList.contains('magnet-btn')) {
      handleExecuteMagnet(targets[index]);
    } else if (btn.classList.contains('edit-btn')) {
      editTarget(index);
    } else if (btn.classList.contains('delete-btn')) {
      deleteTarget(index);
    }
  });
}

/**
 * HTMLをエスケープする
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 磁石を実行する
 */
async function handleExecuteMagnet(target) {
  try {
    await executeMagnet(target, protectedGroups);
    console.log(`Executed magnet for ${target.name}`);
  } catch (e) {
    console.error('Magnet execution failed:', e);
    alert(chrome.i18n.getMessage('errorExecutionFailed'));
  }
}

/**
 * 現在のタブからターゲットを追加する
 */
addCurrentTabBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;

    newNameInput.value = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    newPatternInput.value = domain + '/*';

    showAddForm();
  } catch (e) {
    console.error('Failed to parse current URL:', e);
  }
});

function showAddForm() {
  addFormEl.style.display = 'block';
  showAddFormBtn.classList.add('hidden');
}

function hideAddForm() {
  addFormEl.style.display = 'none';
  showAddFormBtn.classList.remove('hidden');
  newNameInput.value = '';
  newPatternInput.value = '';
  delete saveTargetBtn.dataset.editIndex;
}

showAddFormBtn.addEventListener('click', showAddForm);
cancelAddBtn.addEventListener('click', hideAddForm);

/**
 * ターゲットを保存する
 */
saveTargetBtn.addEventListener('click', async () => {
  const name = newNameInput.value.trim();
  const pattern = newPatternInput.value.trim();

  if (!name || !pattern) {
    alert(chrome.i18n.getMessage('errorInputRequired'));
    return;
  }

  const editIndex = saveTargetBtn.dataset.editIndex;
  if (editIndex !== undefined) {
    targets[editIndex] = { name, pattern };
  } else {
    targets.push({ name, pattern });
  }

  await chrome.storage.local.set({ targets });
  renderTargetList();
  hideAddForm();
});

/**
 * ターゲットを編集する
 */
function editTarget(index) {
  const target = targets[index];
  newNameInput.value = target.name;
  newPatternInput.value = target.pattern;
  saveTargetBtn.dataset.editIndex = index;
  showAddForm();
}

/**
 * ターゲットを削除する
 */
async function deleteTarget(index) {
  if (!confirm(chrome.i18n.getMessage('confirmDelete'))) return;
  targets.splice(index, 1);
  await chrome.storage.local.set({ targets });
  renderTargetList();
}

/**
 * 設定を保存する
 */
saveSettingsBtn.addEventListener('click', async () => {
  protectedGroups = protectedGroupsInput.value.split(',').map(s => s.trim()).filter(s => s);
  await chrome.storage.local.set({ protectedGroups });
  alert(chrome.i18n.getMessage('settingsSaved'));
});

/**
 * エクスポート
 */
exportBtn.addEventListener('click', async () => {
  const data = {
    targets,
    protectedGroups
  };
  const json = JSON.stringify(data, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    alert(chrome.i18n.getMessage('exportSuccess'));
  } catch (e) {
    console.error('Export failed:', e);
    alert(chrome.i18n.getMessage('errorExportFailed'));
  }
});

/**
 * インポート
 */
importBtn.addEventListener('click', async () => {
  try {
    const json = await navigator.clipboard.readText();
    const data = JSON.parse(json);

    if (!data.targets || !Array.isArray(data.targets)) {
      throw new Error(chrome.i18n.getMessage('errorInvalidFormat'));
    }

    // 基本的なバリデーション
    for (const t of data.targets) {
      if (typeof t.name !== 'string' || typeof t.pattern !== 'string') {
        throw new Error(chrome.i18n.getMessage('errorInvalidTargetFormat'));
      }
    }

    if (confirm(chrome.i18n.getMessage('confirmImport'))) {
      targets = data.targets;
      protectedGroups = data.protectedGroups || [];
      await chrome.storage.local.set({ targets, protectedGroups });

      protectedGroupsInput.value = protectedGroups.join(', ');
      renderTargetList();
      alert(chrome.i18n.getMessage('importSuccess'));
    }
  } catch (e) {
    console.error('Import failed:', e);
    alert(chrome.i18n.getMessage('errorImportFailed') + e.message);
  }
});
