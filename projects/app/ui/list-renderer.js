import { state } from './state.js';
import { executeMagnet } from './utils.js';
import { showToast } from './toast.js';

/**
 * HTMLのエスケープ処理
 * @param {string} str - 対象文字列
 * @returns {string} エスケープ済み文字列
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * ターゲットリスト（メイン画面）のレンダリング
 * @param {Function} onEdit - 編集ボタンクリック時のコールバック
 */
export function renderTargetList(onEdit) {
  const targetListEl = document.getElementById('target-list');
  targetListEl.innerHTML = '';

  if (state.targets.length === 0) {
    targetListEl.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-medium);">${chrome.i18n.getMessage('noTargets')}</div>`;
    return;
  }

  const labelExecute = chrome.i18n.getMessage('summonMagnet');

  state.targets.forEach((target, index) => {
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

    item.addEventListener('dragstart', () => item.classList.add('dragging'));
    item.addEventListener('dragend', () => item.classList.remove('dragging'));

    item.addEventListener('click', (e) => {
      if (e.target.closest('.drag-handle') || e.target.closest('.execute-btn')) return;
      onEdit(index);
    });

    const executeBtn = item.querySelector('.execute-btn');
    executeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await executeMagnet(state.targets[index]);
      } catch (err) {
        console.error('Magnet execution failed:', err);
        showToast(chrome.i18n.getMessage('errorExecutionFailed'));
      }
    });

    targetListEl.appendChild(item);
  });
}

/**
 * ドラッグオーバー時の並べ替え処理（メインリスト用）
 */
export function handleDragOver(e) {
  e.preventDefault();
  const targetListEl = document.getElementById('target-list');
  const draggingItem = document.querySelector('.target-list-item.dragging');
  if (!draggingItem) return;

  const siblings = [...targetListEl.querySelectorAll('.target-list-item:not(.dragging)')];
  const nextSibling = siblings.find(sibling => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  targetListEl.insertBefore(draggingItem, nextSibling);
}
