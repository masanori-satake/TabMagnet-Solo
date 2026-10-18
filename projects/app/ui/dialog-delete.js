import { state } from './state.js';

/**
 * 削除確認ダイアログの表示
 * @param {Object|number} target - 削除対象 {type: 'group'|'groupSet', setIndex, groupIndex} または数自インデックス
 */
export function showDeleteDialog(target) {
  const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
  const dialogTextEl = deleteDialogScrim ? deleteDialogScrim.querySelector('.dialog-text') : null;

  if (typeof target === 'number') {
    state.currentDelete = {
      type: 'group',
      setIndex: state.currentEdit ? state.currentEdit.setIndex : 0,
      groupIndex: target
    };
  } else {
    state.currentDelete = target;
  }

  if (dialogTextEl) {
    if (state.currentDelete && state.currentDelete.type === 'groupSet') {
      dialogTextEl.textContent = chrome.i18n.getMessage('confirmDeleteGroupSet') || 'このグループセットを削除しますか？\n含まれるグループもすべて削除されます。';
    } else {
      dialogTextEl.textContent = chrome.i18n.getMessage('confirmDelete') || 'このターゲットを削除しますか？';
    }
  }

  if (deleteDialogScrim) {
    deleteDialogScrim.style.display = 'flex';
  }
}

/**
 * 削除確認ダイアログを隠す
 */
export function hideDeleteDialog() {
  const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
  if (deleteDialogScrim) {
    deleteDialogScrim.style.display = 'none';
  }
  state.currentDelete = { type: null, setIndex: null, groupIndex: null };
}
