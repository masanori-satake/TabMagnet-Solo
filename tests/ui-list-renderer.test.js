import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import { renderTargetList, escapeHtml, handleDragOver } from '../projects/app/ui/list-renderer.js';

describe('ui/list-renderer.js', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      i18n: {
        getMessage: jest.fn(key => key)
      }
    };
    global.chrome = chromeMock;
    document.body.innerHTML = '<div id="target-list"></div>';
    state.groupSets = [];
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('escapeHtml works correctly', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  test('Property 3: renderTargetList renders Group-Set rows with count, order, and color dot class reflecting state.groupSets', () => {
    state.groupSets = [
      { name: 'Set 1', color: 'blue', expanded: true, groups: [{ name: 'G1', pattern: 'g1.com' }] },
      { name: 'Set 2', color: 'red', expanded: false, groups: [] }
    ];

    const onEditGroup = jest.fn();
    const onEditGroupSet = jest.fn();

    renderTargetList(onEditGroup, onEditGroupSet);

    const list = document.getElementById('target-list');
    const setRows = list.querySelectorAll('.group-set-item');
    expect(setRows.length).toBe(2);

    expect(setRows[0].textContent).toContain('Set 1');
    expect(setRows[0].querySelector('.target-color-chip').classList.contains('bg-blue')).toBe(true);

    expect(setRows[1].textContent).toContain('Set 2');
    expect(setRows[1].querySelector('.target-color-chip').classList.contains('bg-red')).toBe(true);
  });

  test('Property 4: Group-Set rows are NOT draggable', () => {
    state.groupSets = [
      { name: 'Set 1', color: 'grey', expanded: true, groups: [] }
    ];

    renderTargetList();

    const setRow = document.querySelector('.group-set-item');
    expect(setRow).toBeTruthy();
    expect(setRow.getAttribute('draggable')).toBeNull();
  });

  test('renders empty notice for expanded Group-Set with no groups', () => {
    state.groupSets = [
      { name: 'Empty Set', color: 'grey', expanded: true, groups: [] }
    ];

    renderTargetList();

    const notice = document.querySelector('.empty-set-notice');
    expect(notice).toBeTruthy();
  });

  test('calls onEditGroup when a Group row is clicked', () => {
    state.groupSets = [
      { name: 'Set 1', color: 'grey', expanded: true, groups: [{ name: 'Group 1', pattern: 'g1.com' }] }
    ];

    const onEditGroup = jest.fn();
    const onEditGroupSet = jest.fn();

    renderTargetList(onEditGroup, onEditGroupSet);

    const groupRow = document.querySelector('.group-item');
    expect(groupRow).toBeTruthy();
    groupRow.click();

    expect(onEditGroup).toHaveBeenCalledWith(0, 0);
  });

  test('Group編集ボタンはフォーカス可能で、対象のインデックスを一度だけ渡す', () => {
    state.groupSets = [
      { name: 'Set 1', expanded: false, groups: [] },
      { name: 'Set 2', expanded: true, groups: [{ name: 'G1' }, { name: 'G2' }] }
    ];
    const onEditGroup = jest.fn();
    renderTargetList(onEditGroup);

    const editBtn = document.querySelectorAll('.group-item .edit-btn')[1];
    expect(editBtn.tagName).toBe('BUTTON');
    expect(editBtn.type).toBe('button');
    expect(editBtn.getAttribute('aria-label')).toBe('edit: G2');
    expect(editBtn.tabIndex).toBe(0);
    editBtn.focus();
    expect(document.activeElement).toBe(editBtn);
    editBtn.querySelector('path').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onEditGroup).toHaveBeenCalledTimes(1);
    expect(onEditGroup).toHaveBeenCalledWith(1, 1);
  });

  test('Group実行ボタンは編集を開始せず、既存の実行処理を呼び出す', async () => {
    chromeMock.windows = { getCurrent: jest.fn().mockResolvedValue({ id: 1 }) };
    chromeMock.tabs = { query: jest.fn().mockResolvedValue([]) };
    chromeMock.storage = { local: { get: jest.fn().mockResolvedValue({}) } };
    chromeMock.tabGroups = { query: jest.fn().mockResolvedValue([]) };
    state.groupSets = [
      { name: 'Set 1', expanded: true, groups: [{ name: 'G1', pattern: 'example.com/*' }] }
    ];
    const onEditGroup = jest.fn();
    renderTargetList(onEditGroup);

    document.querySelector('.group-item .execute-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.windows.getCurrent).toHaveBeenCalledTimes(1);
    expect(chromeMock.tabs.query).toHaveBeenCalledWith({});
    expect(chromeMock.tabGroups.query).toHaveBeenCalledWith({});
    expect(onEditGroup).not.toHaveBeenCalled();
  });

  test('handleDragOver prevents default', () => {
    const event = {
      preventDefault: jest.fn(),
      clientY: 100
    };
    const dragging = document.createElement('div');
    dragging.className = 'group-item dragging';
    dragging.dataset.setIndex = '0';
    document.getElementById('target-list').appendChild(dragging);

    handleDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test.each(['mouse', 'touchend', 'touchcancel'])('並べ替えを繰り返しても行インデックスと両方の編集操作を維持する: %s', async (input) => {
    chromeMock.storage = { local: { set: jest.fn().mockResolvedValue({}) } };
    state.settings.syncEnabled = false;
    state.groupSets = [
      { name: 'Other Set', color: 'grey', expanded: true, groups: [{ name: 'Other', pattern: 'other.example/*' }] },
      {
        name: 'Reordered Set', color: 'blue', expanded: true,
        groups: ['A', 'B', 'C'].map(name => ({ name, pattern: `${name}.example/*` }))
      }
    ];
    const onEditGroup = jest.fn();
    const onEditGroupSet = jest.fn();
    renderTargetList(onEditGroup, onEditGroupSet);

    for (const expectedOrder of [['B', 'C', 'A'], ['C', 'A', 'B']]) {
      const row = document.querySelector('.group-item[data-set-index="1"]');
      if (input === 'mouse') {
        row.dispatchEvent(new Event('dragstart'));
        handleDragOver({ preventDefault: jest.fn(), clientY: 100 });
        row.dispatchEvent(new Event('dragend'));
      } else {
        const handle = row.querySelector('.drag-handle');
        handle.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [{ clientY: 0 }] }));
        handle.dispatchEvent(Object.assign(new Event('touchmove', { cancelable: true }), { touches: [{ clientY: 100 }] }));
        handle.dispatchEvent(new Event(input));
      }
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(state.groupSets[1].groups.map(group => group.name)).toEqual(expectedOrder);
      const rows = document.querySelectorAll('.group-item[data-set-index="1"]');
      rows.forEach((groupRow, index) => {
        expect(groupRow.dataset.groupIndex).toBe(String(index));
        expect(groupRow.querySelector('.target-name').textContent).toBe(expectedOrder[index]);
        groupRow.click();
        expect(onEditGroup).toHaveBeenLastCalledWith(index, 1);
      });
      document.querySelector('.group-set-item[data-set-index="1"] .edit-set-btn').click();
      expect(onEditGroupSet).toHaveBeenLastCalledWith(1);
      expect(state.groupSets[0].groups[0].name).toBe('Other');
    }
    expect(chromeMock.storage.local.set).toHaveBeenCalledTimes(2);
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({ groupSets: state.groupSets });
  });
});
