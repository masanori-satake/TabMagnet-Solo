import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import { showDeleteDialog, hideDeleteDialog } from '../projects/app/ui/dialog-delete.js';

describe('ui/dialog-delete.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="delete-dialog-scrim" style="display: none;">
        <div class="dialog-text"></div>
      </div>
    `;
    global.chrome = {
      i18n: { getMessage: jest.fn(key => key) }
    };
    state.currentDelete = { type: null, setIndex: null, groupIndex: null };
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('showDeleteDialog for GroupSet updates state and UI', () => {
    showDeleteDialog({ type: 'groupSet', setIndex: 1 });
    expect(state.currentDelete).toEqual({ type: 'groupSet', setIndex: 1 });
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('flex');
    expect(document.querySelector('.dialog-text').textContent).toBe('confirmDeleteGroupSet');
  });

  test('showDeleteDialog for Group updates state and UI', () => {
    showDeleteDialog({ type: 'group', setIndex: 0, groupIndex: 2 });
    expect(state.currentDelete).toEqual({ type: 'group', setIndex: 0, groupIndex: 2 });
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('flex');
    expect(document.querySelector('.dialog-text').textContent).toBe('confirmDelete');
  });

  test('hideDeleteDialog resets state and UI', () => {
    showDeleteDialog({ type: 'groupSet', setIndex: 0 });
    hideDeleteDialog();
    expect(state.currentDelete).toEqual({ type: null, setIndex: null, groupIndex: null });
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('none');
  });
});
