import { executeMagnet } from './ui/utils.js';

// DOM elements
const targetListEl = document.getElementById('target-list');
const addNewBtn = document.getElementById('add-new-btn');
const addFromDomainBtn = document.getElementById('add-from-domain-btn');
const settingsBtn = document.getElementById('settings-btn');

// Modal elements
const targetModalScrim = document.getElementById('target-modal-scrim');
const modalTitleEl = document.getElementById('modal-title');
const newNameInput = document.getElementById('new-name');
const newPatternInput = document.getElementById('new-pattern');
const colorOptions = document.querySelectorAll('.color-option');
const deleteTargetBtn = document.getElementById('delete-target-btn');
const cancelTargetBtn = document.getElementById('cancel-target-btn');
const saveTargetBtn = document.getElementById('save-target-btn');

// Delete Dialog elements
const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
const confirmDeleteCancelBtn = document.getElementById('confirm-delete-cancel-btn');
const confirmDeleteOkBtn = document.getElementById('confirm-delete-ok-btn');

// State
let targets = [];
let protectedGroups = [];
let selectedColor = 'grey';
let currentEditIndex = null;
let currentDeleteIndex = null;

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

  renderTargetList();
  setupEventListeners();

  // ストレージ変更を監視してUIを同期
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.targets) {
      const nextTargets = changes.targets.newValue || [];
      if (JSON.stringify(nextTargets) !== JSON.stringify(targets)) {
        targets = nextTargets;
        renderTargetList();
      }
    }

    if (changes.protectedGroups) {
      protectedGroups = changes.protectedGroups.newValue || [];
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
    targetListEl.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-medium);">${chrome.i18n.getMessage('noTargets')}</div>`;
    return;
  }

  const labelExecute = chrome.i18n.getMessage('summonMagnet');
  const labelEdit = chrome.i18n.getMessage('edit');

  targets.forEach((target, index) => {
    const item = document.createElement('div');
    item.className = 'target-list-item';

    const colorClass = `bg-${target.color || 'grey'}`;

    item.innerHTML = `
      <div class="target-info">
        <div class="target-color-chip ${colorClass}"></div>
        <div class="target-name">${escapeHtml(target.name)}</div>
      </div>
      <div class="target-actions">
        <button class="icon-button edit-btn" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
          <span class="tooltip">${labelEdit}</span>
        </button>
        <button class="icon-button execute-btn" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v80h-80v-80H200v560h560v-80h80v80q0 33-23.5 56.5T760-120H200Zm480-160-56-56 103-104H360v-80h367L624-624l56-56 200 200-200 200Z"/></svg>
          <span class="tooltip">${labelExecute}</span>
        </button>
      </div>
    `;
    targetListEl.appendChild(item);
  });
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // リスト内ボタンのイベント委譲
  targetListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-button');
    if (!btn) return;

    const index = parseInt(btn.dataset.index);
    if (isNaN(index)) return;

    if (btn.classList.contains('execute-btn')) {
      handleExecuteMagnet(targets[index]);
    } else if (btn.classList.contains('edit-btn')) {
      showModal(index);
    }
  });

  // フッターボタン
  addNewBtn.addEventListener('click', () => showModal());
  addFromDomainBtn.addEventListener('click', handleAddFromDomain);

  // モーダル内ボタン
  cancelTargetBtn.addEventListener('click', hideModal);
  saveTargetBtn.addEventListener('click', handleSaveTarget);
  deleteTargetBtn.addEventListener('click', () => {
    showDeleteDialog(currentEditIndex);
  });

  // カラー選択
  colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectColor(opt.dataset.color);
    });
  });

  // 削除ダイアログボタン
  confirmDeleteCancelBtn.addEventListener('click', hideDeleteDialog);
  confirmDeleteOkBtn.addEventListener('click', handleConfirmDelete);

  // 設定ボタン（将来用）
  settingsBtn.addEventListener('click', () => {
    console.log('Settings button clicked');
  });
}

/**
 * モーダルを表示
 */
function showModal(index = null) {
  currentEditIndex = index;
  if (index !== null) {
    const target = targets[index];
    modalTitleEl.textContent = chrome.i18n.getMessage('edit');
    newNameInput.value = target.name;
    newPatternInput.value = target.pattern;
    selectColor(target.color || 'grey');
    deleteTargetBtn.classList.remove('hidden');
  } else {
    modalTitleEl.textContent = chrome.i18n.getMessage('addNew');
    newNameInput.value = '';
    newPatternInput.value = '';
    selectColor('grey');
    deleteTargetBtn.classList.add('hidden');
  }
  targetModalScrim.style.display = 'flex';
}

function hideModal() {
  targetModalScrim.style.display = 'none';
  currentEditIndex = null;
}

/**
 * カラーを選択
 */
function selectColor(color) {
  selectedColor = color;
  colorOptions.forEach(opt => {
    if (opt.dataset.color === color) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });
}

/**
 * 保存処理
 */
async function handleSaveTarget() {
  const name = newNameInput.value.trim();
  const pattern = newPatternInput.value.trim();

  if (!name || !pattern) {
    alert(chrome.i18n.getMessage('errorInputRequired'));
    return;
  }

  const targetData = { name, pattern, color: selectedColor };

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
 * 現在のタブドメインから作成
 */
async function handleAddFromDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    const pattern = domain + '/*';

    showModal();
    newNameInput.value = name;
    newPatternInput.value = pattern;
  } catch (e) {
    console.error('Failed to parse current URL:', e);
  }
}

/**
 * 削除確認ダイアログを表示
 */
function showDeleteDialog(index) {
  currentDeleteIndex = index;
  deleteDialogScrim.style.display = 'flex';
}

function hideDeleteDialog() {
  deleteDialogScrim.style.display = 'none';
  currentDeleteIndex = null;
}

/**
 * 削除確定処理
 */
async function handleConfirmDelete() {
  if (currentDeleteIndex !== null) {
    targets.splice(currentDeleteIndex, 1);
    await chrome.storage.local.set({ targets });
    renderTargetList();
  }
  hideDeleteDialog();
  hideModal();
}

/**
 * 磁石を実行
 */
async function handleExecuteMagnet(target) {
  try {
    await executeMagnet(target, protectedGroups);
  } catch (e) {
    console.error('Magnet execution failed:', e);
    alert(chrome.i18n.getMessage('errorExecutionFailed'));
  }
}

/**
 * HTMLをエスケープ
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
