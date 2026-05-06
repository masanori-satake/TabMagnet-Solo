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

  test('renderTargetList shows empty message when no targets', () => {
    renderTargetList();
    const list = document.getElementById('target-list');
    expect(list.textContent).toContain('noTargets');
  });

  test('renderTargetList renders items', () => {
    state.targets = [{ name: 'Target 1', color: 'blue' }];
    const onEdit = jest.fn();
    renderTargetList(onEdit);

    const item = document.querySelector('.target-list-item');
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
