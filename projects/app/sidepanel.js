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
 * 初期化処理
 */
async function init() {
  const data = await chrome.storage.local.get(['targets', 'protectedGroups']);
  targets = data.targets || [];
  protectedGroups = data.protectedGroups || [];

  protectedGroupsInput.value = protectedGroups.join(', ');
  renderTargetList();
  setupEventListeners();
}

/**
 * ターゲットリストをレンダリングする
 */
function renderTargetList() {
  targetListEl.innerHTML = '';
  if (targets.length === 0) {
    targetListEl.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">登録されたターゲットはありません。</div>';
    return;
  }

  targets.forEach((target, index) => {
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `
      <div class="target-header">
        <div class="target-name">${escapeHtml(target.name)}</div>
        <button class="btn-primary magnet-btn" data-index="${index}">磁石（召喚）</button>
      </div>
      <div class="target-pattern">${escapeHtml(target.pattern)}</div>
      <div class="actions">
        <button class="btn-text edit-btn" data-index="${index}">編集</button>
        <button class="btn-text btn-error delete-btn" data-index="${index}">削除</button>
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
    alert('実行に失敗しました。');
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
    alert('名前とパターンを入力してください。');
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
  if (!confirm('このターゲットを削除しますか？')) return;
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
  alert('設定を保存しました。');
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
    alert('設定をクリップボードにコピーしました。');
  } catch (e) {
    console.error('Export failed:', e);
    alert('エクスポートに失敗しました。');
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
      throw new Error('無効なデータ形式です。');
    }

    // 基本的なバリデーション
    for (const t of data.targets) {
      if (typeof t.name !== 'string' || typeof t.pattern !== 'string') {
        throw new Error('ターゲットの形式が正しくありません。');
      }
    }

    if (confirm('現在の設定を上書きしてインポートしますか？')) {
      targets = data.targets;
      protectedGroups = data.protectedGroups || [];
      await chrome.storage.local.set({ targets, protectedGroups });

      protectedGroupsInput.value = protectedGroups.join(', ');
      renderTargetList();
      alert('インポートが完了しました。');
    }
  } catch (e) {
    console.error('Import failed:', e);
    alert('インポートに失敗しました。クリップボードに有効な設定JSONがあることを確認してください。\n' + e.message);
  }
});

init();
