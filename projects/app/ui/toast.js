/**
 * トースト通知の表示制御
 */

/**
 * 指定したメッセージでトーストを表示する
 * @param {string} message - 表示するメッセージ
 */
export function showToast(message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;

  // 以前のタイマーがあればクリア
  if (window._toastTimeout) {
    clearTimeout(window._toastTimeout);
  }

  toastEl.textContent = message;
  toastEl.classList.add('show');

  window._toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
    window._toastTimeout = null;
  }, 3000);
}
