/**
 * HTMLの要素にi18nメッセージを適用する
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
