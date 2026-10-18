import { state, saveGroupSets } from './state.js';
import {
  createDefaultGroupSet,
  isEdge,
  getCompatibleColor,
  isSpecialPage
} from './utils.js';
import { MAX_GROUP_SETS, MAX_GROUPS_PER_SET, MAX_GROUP_SET_NAME_LENGTH, COLORS_CHROME, COLORS_EDGE } from './constants.js';
import { showDeleteDialog } from './dialog-delete.js';

let renderCallback = null;

/**
 * リスト再描画用のコールバックを設定する
 * @param {Function} cb - 再描画関数
 */
export function setRenderCallback(cb) {
  renderCallback = cb;
}

/**
 * リスト再描画を呼び出す
 */
function requestRender() {
  if (typeof renderCallback === 'function') {
    renderCallback();
  }
}

/**
 * モーダルのフィードバックメッセージを非表示にする
 */
export function hideGroupSetModalFeedback() {
  const fb = document.getElementById('gs-modal-feedback');
  if (fb) {
    fb.textContent = '';
    fb.classList.add('hidden');
  }
}

/**
 * モーダルのフィードバックメッセージを表示する
 * @param {string} msg - 表示するメッセージ
 */
export function showGroupSetModalFeedback(msg) {
  const fb = document.getElementById('gs-modal-feedback');
  if (fb) {
    fb.textContent = msg;
    fb.classList.remove('hidden');
  }
}

/**
 * 編集メニューダイアログの選択肢ボタンの有効/無効状態を更新する
 * @param {number} setIndex - Group-Setのインデックス
 */
export async function updateEditMenuButtonStates(setIndex) {
  const groupSet = state.groupSets[setIndex];
  if (!groupSet) return;

  const addGroupBtn = document.getElementById('gs-edit-menu-add-group');
  const addFromDomainBtn = document.getElementById('gs-edit-menu-add-from-domain');
  const moveUpBtn = document.getElementById('gs-edit-menu-move-up');
  const moveDownBtn = document.getElementById('gs-edit-menu-move-down');

  // 新規グループの追加: 100件上限
  if (addGroupBtn) {
    const isFull = (groupSet.groups || []).length >= MAX_GROUPS_PER_SET;
    addGroupBtn.disabled = isFull;
    addGroupBtn.classList.toggle('disabled', isFull);
  }

  // 表示中タブから新規グループを追加: アクティブタブが特殊ページの場合無効
  if (addFromDomainBtn) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isSpecial = !activeTab || !activeTab.url || isSpecialPage(activeTab.url);
      addFromDomainBtn.disabled = isSpecial;
      addFromDomainBtn.classList.toggle('disabled', isSpecial);
    } catch {
      addFromDomainBtn.disabled = true;
      addFromDomainBtn.classList.add('disabled');
    }
  }

  // 上に移動 / 下に移動
  const totalSets = state.groupSets.length;
  if (moveUpBtn) {
    const isMoveUpDisabled = totalSets <= 1 || setIndex === 0;
    moveUpBtn.disabled = isMoveUpDisabled;
    moveUpBtn.classList.toggle('disabled', isMoveUpDisabled);
  }

  if (moveDownBtn) {
    const isMoveDownDisabled = totalSets <= 1 || setIndex === totalSets - 1;
    moveDownBtn.disabled = isMoveDownDisabled;
    moveDownBtn.classList.toggle('disabled', isMoveDownDisabled);
  }
}

/**
 * グループセット編集メニューダイアログを表示する
 * @param {number} setIndex - 対象Group-Setのインデックス
 */
export async function showGroupSetEditMenu(setIndex) {
  state.currentEditSetIndex = setIndex;
  await updateEditMenuButtonStates(setIndex);
  const scrim = document.getElementById('gs-edit-menu-scrim');
  if (scrim) {
    scrim.style.display = 'flex';
  }
}

/**
 * グループセット編集メニューダイアログを非表示にする
 */
export function hideGroupSetEditMenu() {
  const scrim = document.getElementById('gs-edit-menu-scrim');
  if (scrim) {
    scrim.style.display = 'none';
  }
}

/**
 * グループセット削除ボタンの有効/無効状態を更新する
 */
export function updateGroupSetDeleteButtonState() {
  const deleteBtn = document.getElementById('delete-group-set-btn');
  if (!deleteBtn) return;

  const isDisabled = state.groupSets.length <= 1;
  deleteBtn.disabled = isDisabled;
  deleteBtn.classList.toggle('disabled', isDisabled);
}

/**
 * Group-Set用カラーパレットの選択肢を生成・レンダリングする
 */
export function renderGroupSetColorOptions() {
  const container = document.getElementById('gs-color-selection');
  if (!container) return;
  container.innerHTML = '';

  const colors = isEdge() ? COLORS_EDGE : COLORS_CHROME;
  const template = document.getElementById('color-option-template');

  colors.forEach(color => {
    const option = template.content.cloneNode(true).querySelector('.color-option');
    option.classList.add(`bg-${color}`);
    option.dataset.color = color;

    const msgKey = isEdge() ? `color${color.charAt(0).toUpperCase() + color.slice(1)}Edge` : `color${color.charAt(0).toUpperCase() + color.slice(1)}`;
    const tooltip = option.querySelector('.tooltip');
    if (tooltip) {
      tooltip.textContent = chrome.i18n.getMessage(msgKey) || color;
    }

    if (color === state.selectedSetColor) {
      option.classList.add('selected');
    }

    option.addEventListener('click', () => {
      selectGroupSetColor(color);
    });

    container.appendChild(option);
  });
}

/**
 * Group-Setのカラーを選択する
 * @param {string} color - 選択された色キー
 */
export function selectGroupSetColor(color) {
  state.selectedSetColor = color;
  const container = document.getElementById('gs-color-selection');
  if (!container) return;

  container.querySelectorAll('.color-option').forEach(opt => {
    if (opt.dataset.color === color) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });
}

/**
 * グループセット編集ダイアログを表示する
 * @param {number} setIndex - 対象Group-Setのインデックス
 */
export function showGroupSetModal(setIndex) {
  state.currentEditSetIndex = setIndex;
  const groupSet = state.groupSets[setIndex];
  if (!groupSet) return;

  const nameInput = document.getElementById('gs-edit-name');
  if (nameInput) {
    nameInput.value = groupSet.name;
  }

  state.selectedSetColor = getCompatibleColor(groupSet.color || 'grey');
  renderGroupSetColorOptions();
  updateGroupSetDeleteButtonState();
  hideGroupSetModalFeedback();

  const scrim = document.getElementById('gs-edit-modal-scrim');
  if (scrim) {
    scrim.style.display = 'flex';
  }
}

/**
 * グループセット編集ダイアログを非表示にする
 */
export function hideGroupSetModal() {
  const scrim = document.getElementById('gs-edit-modal-scrim');
  if (scrim) {
    scrim.style.display = 'none';
  }
}

/**
 * グループセットの展開/縮小状態を切り替える
 * @param {number} setIndex - 対象Group-Setのインデックス
 */
export async function toggleGroupSetExpanded(setIndex) {
  if (!state.groupSets[setIndex]) return;

  state.groupSets[setIndex].expanded = !state.groupSets[setIndex].expanded;
  await saveGroupSets(state.groupSets);
  requestRender();
}

/**
 * グループセットを上または下に移動する
 * @param {number} setIndex - 対象Group-Setのインデックス
 * @param {number} direction - -1（上移動）または 1（下移動）
 */
export async function moveGroupSet(setIndex, direction) {
  const total = state.groupSets.length;
  if (total <= 1) return;

  if (direction === -1 && setIndex <= 0) return;
  if (direction === 1 && setIndex >= total - 1) return;

  const targetIndex = setIndex + direction;
  const temp = state.groupSets[setIndex];
  state.groupSets[setIndex] = state.groupSets[targetIndex];
  state.groupSets[targetIndex] = temp;

  await saveGroupSets(state.groupSets);
  hideGroupSetEditMenu();
  requestRender();
}

/**
 * グループセット削除ダイアログを表示する
 * @param {number} setIndex - 対象Group-Setのインデックス
 */
export function deleteGroupSet(setIndex) {
  if (state.groupSets.length <= 1) return;
  showDeleteDialog({ type: 'groupSet', setIndex });
}

/**
 * 新規グループセットを追加する
 */
export async function addGroupSet() {
  if (state.groupSets.length >= MAX_GROUP_SETS) return;

  const newSet = createDefaultGroupSet();
  state.groupSets.push(newSet);
  await saveGroupSets(state.groupSets);
  requestRender();
}

/**
 * グループセット名と色を保存する
 * @param {number} setIndex - 対象Group-Setのインデックス
 */
export async function saveGroupSet(setIndex) {
  const nameInput = document.getElementById('gs-edit-name');
  if (!nameInput) return;

  const nameValue = nameInput.value ? nameInput.value.trim() : '';
  if (!nameValue) {
    showGroupSetModalFeedback(chrome.i18n.getMessage('errorGroupNameRequired') || 'グループセット名を入力してください');
    return;
  }
  if (nameValue.length > MAX_GROUP_SET_NAME_LENGTH) {
    showGroupSetModalFeedback(chrome.i18n.getMessage('errorGroupSetNameTooLong', [String(MAX_GROUP_SET_NAME_LENGTH)]) || `グループセット名は${MAX_GROUP_SET_NAME_LENGTH}文字以内で入力してください`);
    return;
  }

  if (state.groupSets[setIndex]) {
    state.groupSets[setIndex].name = nameValue;
    state.groupSets[setIndex].color = state.selectedSetColor;
    await saveGroupSets(state.groupSets);
    hideGroupSetModal();
    requestRender();
  }
}
