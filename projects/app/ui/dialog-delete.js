import { state } from './state.js';

/**
 * 削除確認ダイアログの表示
 * @param {number} index - 削除対象ターゲットのインデックス
 */
export function showDeleteDialog(index) {
  const deleteDialogScrim = document.getElementById('delete-dialog-scrim');
  state.currentDeleteIndex = index;
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
  state.currentDeleteIndex = null;
}
