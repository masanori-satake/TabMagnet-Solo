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
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;"\'');
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
});
