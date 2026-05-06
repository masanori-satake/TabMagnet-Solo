import { state } from './state.js';
import { escapeHtml } from './list-renderer.js';
import { applyI18n } from './i18n.js';

/**
 * ターゲット追加・編集モーダルの表示
 * @param {number|null} index - 編集対象のインデックス（新規の場合はnull）
 */
export function showTargetModal(index = null) {
  const targetModalScrim = document.getElementById('target-modal-scrim');
  const modalTitleEl = document.getElementById('modal-title');
  const newNameInput = document.getElementById('new-name');
  const patternListContainer = document.getElementById('pattern-list-container');
  const deleteTargetBtn = document.getElementById('delete-target-btn');

  state.currentEditIndex = index;
  if (patternListContainer) patternListContainer.innerHTML = '';
  hideModalFeedback();

  if (index !== null) {
    const target = state.targets[index];
    if (modalTitleEl) modalTitleEl.textContent = chrome.i18n.getMessage('edit');
    if (newNameInput) newNameInput.value = target.name;
    const patterns = Array.isArray(target.pattern) ? target.pattern : [target.pattern];
    patterns.forEach(p => addPatternInput(p));
    selectColor(target.color || 'grey');
    if (deleteTargetBtn) deleteTargetBtn.classList.remove('hidden');
  } else {
    if (modalTitleEl) modalTitleEl.textContent = chrome.i18n.getMessage('addNew');
    if (newNameInput) newNameInput.value = '';
    addPatternInput();
    selectColor('grey');
    if (deleteTargetBtn) deleteTargetBtn.classList.add('hidden');
  }
  if (targetModalScrim) targetModalScrim.style.display = 'flex';
}

/**
 * ターゲットモーダルを閉じる
 */
export function hideTargetModal() {
  const targetModalScrim = document.getElementById('target-modal-scrim');
  if (targetModalScrim) targetModalScrim.style.display = 'none';
  state.currentEditIndex = null;
}

/**
 * モーダル内のフィードバックメッセージを表示
 * @param {string} message
 */
export function showModalFeedback(message) {
  const modalFeedbackEl = document.getElementById('modal-feedback');
  if (modalFeedbackEl) {
    modalFeedbackEl.textContent = message;
    modalFeedbackEl.classList.remove('hidden');
  }
}

/**
 * モーダル内のフィードバックメッセージを隠す
 */
export function hideModalFeedback() {
  const modalFeedbackEl = document.getElementById('modal-feedback');
  if (modalFeedbackEl) {
    modalFeedbackEl.classList.add('hidden');
    modalFeedbackEl.textContent = '';
  }
}

/**
 * パターン入力欄をモーダルに追加
 * @param {string} value - 初期値
 */
export function addPatternInput(value = '') {
  const patternListContainer = document.getElementById('pattern-list-container');
  if (!patternListContainer) return;

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
 * カラーの選択状態を更新
 * @param {string} color
 */
export function selectColor(color) {
  state.selectedColor = color;
  const colorOptions = document.querySelectorAll('.color-option');
  colorOptions.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.color === color);
  });
}

/**
 * パターンのドラッグオーバー処理
 */
export function handlePatternDragOver(e) {
  const patternListContainer = document.getElementById('pattern-list-container');
  if (!patternListContainer) return;

  e.preventDefault();
  const draggingItem = patternListContainer.querySelector('.dragging');
  if (!draggingItem) return;
  const siblings = [...patternListContainer.querySelectorAll('.pattern-item:not(.dragging)')];
  const nextSibling = siblings.find(sibling => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  patternListContainer.insertBefore(draggingItem, nextSibling);
}
