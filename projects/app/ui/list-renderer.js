import { state, saveGroupSets } from './state.js';
import { executeMagnet, executeAllMagnets } from './utils.js';
import { showToast } from './toast.js';
import { toggleGroupSetExpanded } from './group-set.js';

let onEditGroupCallback;
let onEditGroupSetCallback;

/**
 * HTMLのエスケープ処理
 * @param {string} str - 対象文字列
 * @returns {string} エスケープ済み文字列
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 空のGroup-Set用案内テキスト要素を生成する
 * @returns {HTMLElement} 案内テキスト要素
 */
function createEmptyGroupSetNotice() {
  const emptyEl = document.createElement('div');
  emptyEl.className = 'empty-set-notice';
  emptyEl.textContent = chrome.i18n.getMessage('gsEmptyNotice') || '登録されたグループがありません';
  return emptyEl;
}

/**
 * Group-Set行を生成する
 * @param {Object} groupSet - Group-Setオブジェクト
 * @param {number} setIndex - Group-Setのインデックス
 * @param {Function} onEditGroupSet - 編集ボタン押下時のコールバック
 * @returns {HTMLElement} Group-Set行要素
 */
function createGroupSetRow(groupSet, setIndex, onEditGroupSet) {
  const row = document.createElement('div');
  row.className = 'target-list-item group-set-item';
  row.dataset.static = 'true';
  row.dataset.setIndex = setIndex;

  const colorClass = `bg-${groupSet.color || 'grey'}`;
  const isExpanded = !!groupSet.expanded;
  const isExecuteDisabled = !groupSet.groups || groupSet.groups.length === 0;

  const toggleLabel = isExpanded
    ? (chrome.i18n.getMessage('gsExpandButton', [groupSet.name]) || `グループセット「${groupSet.name}」を縮小`)
    : (chrome.i18n.getMessage('gsCollapseButton', [groupSet.name]) || `グループセット「${groupSet.name}」を展開`);

  const executeLabel = chrome.i18n.getMessage('gsExecuteButton', [groupSet.name]) || `グループセット「${groupSet.name}」を実行`;

  // 展開・折りたたみボタン
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'icon-button toggle-expand-btn';
  toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  toggleBtn.setAttribute('aria-label', toggleLabel);
  toggleBtn.innerHTML = isExpanded
    ? `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>`;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleGroupSetExpanded(setIndex);
  });

  // グループセット情報表示領域
  const targetInfo = document.createElement('div');
  targetInfo.className = 'target-info';

  const colorChip = document.createElement('div');
  colorChip.className = `target-color-chip ${colorClass}`;

  const nameEl = document.createElement('button');
  nameEl.type = 'button';
  nameEl.className = 'target-name';
  nameEl.textContent = groupSet.name || '';
  nameEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof onEditGroupSet === 'function') {
      onEditGroupSet(setIndex);
    }
  });

  targetInfo.appendChild(colorChip);
  targetInfo.appendChild(nameEl);

  // 操作アクションボタン群
  const targetActions = document.createElement('div');
  targetActions.className = 'target-actions';

  const executeSetBtn = document.createElement('button');
  executeSetBtn.className = `icon-button execute-set-btn${isExecuteDisabled ? ' disabled' : ''}`;
  if (isExecuteDisabled) {
    executeSetBtn.disabled = true;
  }
  executeSetBtn.setAttribute('aria-label', executeLabel);
  executeSetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M5 2h4v3H5V2zm10 0h4v3h-4V2zM5 6v8c0 3.87 3.13 7 7 7s7-3.13 7-7V6h-4v8c0 1.66-1.34 3-3 3s-3-1.34-3-3V6H5z"/></svg>`;

  if (!isExecuteDisabled) {
    executeSetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await executeAllMagnets(groupSet.groups);
      } catch (err) {
        console.error('Group-Set execution failed:', err);
        showToast(chrome.i18n.getMessage('errorExecutionFailed'));
      }
    });
  }

  targetActions.appendChild(executeSetBtn);

  row.appendChild(toggleBtn);
  row.appendChild(targetInfo);
  row.appendChild(targetActions);

  return row;
}

/**
 * Group行を生成する
 * @param {Object} group - Groupオブジェクト
 * @param {number} setIndex - 所属するGroup-Setのインデックス
 * @param {number} groupIndex - Groupのインデックス
 * @param {Function} onEditGroup - Group編集コールバック
 * @returns {HTMLElement} Group行要素
 */
function createGroupRow(group, setIndex, groupIndex, onEditGroup) {
  const item = document.createElement('div');
  item.className = 'target-list-item group-item';
  item.draggable = true;
  item.dataset.setIndex = setIndex;
  item.dataset.groupIndex = groupIndex;

  const colorClass = `bg-${group.color || 'grey'}`;
  const labelExecute = chrome.i18n.getMessage('summonMagnet');

  // ドラッグハンドル
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" style="fill: currentColor;"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T360-640Z"/></svg>`;

  // グループ情報表示領域
  const targetInfo = document.createElement('div');
  targetInfo.className = 'target-info';

  const colorChip = document.createElement('div');
  colorChip.className = `target-color-chip ${colorClass}`;

  const nameEl = document.createElement('button');
  nameEl.type = 'button';
  nameEl.className = 'target-name';
  nameEl.textContent = group.name || '';

  targetInfo.appendChild(colorChip);
  targetInfo.appendChild(nameEl);

  nameEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof onEditGroup === 'function') {
      onEditGroup(groupIndex, setIndex);
    }
  });

  // 操作アクション領域
  const targetActions = document.createElement('div');
  targetActions.className = 'target-actions';

  const executeBtn = document.createElement('button');
  executeBtn.className = 'icon-button execute-btn';
  executeBtn.setAttribute('aria-label', labelExecute);

  const tooltipSpan = document.createElement('span');
  tooltipSpan.className = 'tooltip';
  tooltipSpan.textContent = labelExecute;

  executeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M5 2h4v3H5V2zm10 0h4v3h-4V2zM5 6v8c0 3.87 3.13 7 7 7s7-3.13 7-7V6h-4v8c0 1.66-1.34 3-3 3s-3-1.34-3-3V6H5z"/></svg>`;
  executeBtn.appendChild(tooltipSpan);

  targetActions.appendChild(executeBtn);

  item.appendChild(dragHandle);
  item.appendChild(targetInfo);
  item.appendChild(targetActions);

  item.addEventListener('dragstart', () => item.classList.add('dragging'));
  item.addEventListener('dragend', async () => {
    item.classList.remove('dragging');
    await updateGroupOrderAfterDrag(setIndex);
  });

  item.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle') || e.target.closest('.execute-btn')) return;
    if (typeof onEditGroup === 'function') {
      onEditGroup(groupIndex, setIndex);
    }
  });

  executeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await executeMagnet(group);
    } catch (err) {
      console.error('Magnet execution failed:', err);
      showToast(chrome.i18n.getMessage('errorExecutionFailed'));
    }
  });

  const targetListEl = document.getElementById('target-list');
  setupTouchDragList(dragHandle, item, targetListEl, setIndex);

  return item;
}

/**
 * ドラッグ後のグループ順序を更新する
 * @param {number} setIndex - 対象Group-Setのインデックス
 */
async function updateGroupOrderAfterDrag(setIndex) {
  const targetListEl = document.getElementById('target-list');
  const groupRows = [...targetListEl.querySelectorAll(`.group-item[data-set-index="${setIndex}"]`)];
  if (groupRows.length === 0 || !state.groupSets[setIndex]) return;

  const currentGroups = state.groupSets[setIndex].groups;
  const newGroups = groupRows.map(el => currentGroups[parseInt(el.dataset.groupIndex)]).filter(Boolean);

  if (newGroups.length === currentGroups.length) {
    state.groupSets[setIndex].groups = newGroups;
    await saveGroupSets(state.groupSets);
    // 行のインデックスと両方の編集コールバックを最新の状態にそろえる。
    renderTargetList(onEditGroupCallback, onEditGroupSetCallback);
  }
}

/**
 * ターゲットリスト（メイン画面）のレンダリング
 * @param {Function} onEditGroup - Group編集時のコールバック
 * @param {Function} onEditGroupSet - Group-Set編集ボタンクリック時のコールバック
 */
export function renderTargetList(onEditGroup, onEditGroupSet) {
  onEditGroupCallback = onEditGroup;
  onEditGroupSetCallback = onEditGroupSet;
  const targetListEl = document.getElementById('target-list');
  if (!targetListEl) return;
  targetListEl.innerHTML = '';

  state.groupSets.forEach((groupSet, setIndex) => {
    const setRow = createGroupSetRow(groupSet, setIndex, onEditGroupSet);
    targetListEl.appendChild(setRow);

    if (groupSet.expanded) {
      if (!groupSet.groups || groupSet.groups.length === 0) {
        const emptyEl = createEmptyGroupSetNotice();
        targetListEl.appendChild(emptyEl);
      } else {
        groupSet.groups.forEach((group, groupIndex) => {
          const groupRow = createGroupRow(group, setIndex, groupIndex, onEditGroup);
          targetListEl.appendChild(groupRow);
        });
      }
    }
  });
}

/**
 * タッチ操作用ドラッグ＆ドロップの設定（Group並べ替え用）
 * @param {HTMLElement} handle - ドラッグハンドル要素
 * @param {HTMLElement} item - リスト項目要素
 * @param {HTMLElement} container - 親コンテナ要素
 * @param {number} setIndex - 所属するGroup-Setインデックス
 */
function setupTouchDragList(handle, item, container, setIndex) {
  let isDragging = false;

  handle.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    isDragging = true;
    item.classList.add('dragging');
  }, { passive: false });

  handle.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    const siblings = [...container.querySelectorAll(`.group-item[data-set-index="${setIndex}"]:not(.dragging)`)];
    const nextSibling = siblings.find(sibling => {
      const rect = sibling.getBoundingClientRect();
      return touchY <= rect.top + rect.height / 2;
    });
    if (nextSibling) {
      container.insertBefore(item, nextSibling);
    } else {
      // 当該Group-Set内の最後のGroup行の後ろに挿入
      const lastSibling = siblings[siblings.length - 1];
      if (lastSibling && lastSibling.nextSibling) {
        container.insertBefore(item, lastSibling.nextSibling);
      } else {
        container.appendChild(item);
      }
    }
  }, { passive: false });

  const endDrag = async () => {
    if (!isDragging) return;
    isDragging = false;
    item.classList.remove('dragging');
    await updateGroupOrderAfterDrag(setIndex);
  };

  handle.addEventListener('touchend', endDrag);
  handle.addEventListener('touchcancel', endDrag);
}

/**
 * ドラッグオーバー時の並べ替え処理（Group行のみ）
 */
export function handleDragOver(e) {
  e.preventDefault();
  const targetListEl = document.getElementById('target-list');
  const draggingItem = document.querySelector('.group-item.dragging');
  if (!draggingItem) return;

  const setIndex = draggingItem.dataset.setIndex;
  const siblings = [...targetListEl.querySelectorAll(`.group-item[data-set-index="${setIndex}"]:not(.dragging)`)];
  const nextSibling = siblings.find(sibling => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  if (nextSibling) {
    targetListEl.insertBefore(draggingItem, nextSibling);
  } else if (siblings.length > 0) {
    const lastSibling = siblings[siblings.length - 1];
    if (lastSibling.nextSibling) {
      targetListEl.insertBefore(draggingItem, lastSibling.nextSibling);
    } else {
      targetListEl.appendChild(draggingItem);
    }
  }
}
