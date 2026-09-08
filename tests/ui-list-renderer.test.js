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
    state.targets = [];
  });

  test('escapeHtml works correctly', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;"\'');
  });

  test('renderTargetList shows Magnet All row and empty message when no targets', () => {
    renderTargetList();
    const list = document.getElementById('target-list');
    expect(list.textContent).toContain('magnetAll');
    expect(list.textContent).toContain('noTargets');

    const executeAllBtn = list.querySelector('.execute-all-btn');
    expect(executeAllBtn).toBeTruthy();
    expect(executeAllBtn.disabled).toBe(true);
  });

  test('renderTargetList renders items and enables Magnet All button', () => {
    state.targets = [{ name: 'Target 1', color: 'blue' }];
    const onEdit = jest.fn();
    renderTargetList(onEdit);

    const staticItem = document.querySelector('.magnet-all-item');
    expect(staticItem).toBeTruthy();
    const executeAllBtn = staticItem.querySelector('.execute-all-btn');
    expect(executeAllBtn.disabled).toBe(false);

    const item = document.querySelector('.target-list-item:not([data-static="true"])');
    expect(item).toBeTruthy();
    expect(item.textContent).toContain('Target 1');
    expect(item.querySelector('.target-color-chip').classList.contains('bg-blue')).toBe(true);

    item.click();
    expect(onEdit).toHaveBeenCalledWith(0);
  });

  test('handleDragOver prevents default', () => {
    const event = {
      preventDefault: jest.fn(),
      clientY: 100
    };
    // Need a dragging element
    const dragging = document.createElement('div');
    dragging.className = 'target-list-item dragging';
    document.getElementById('target-list').appendChild(dragging);

    handleDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
