import { state } from '../projects/app/ui/state.js';
import { showDeleteDialog, hideDeleteDialog } from '../projects/app/ui/dialog-delete.js';

describe('ui/dialog-delete.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="delete-dialog-scrim" style="display: none;"></div>';
    state.currentDeleteIndex = null;
  });

  test('showDeleteDialog updates state and UI', () => {
    showDeleteDialog(5);
    expect(state.currentDeleteIndex).toBe(5);
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('flex');
  });

  test('hideDeleteDialog resets state and UI', () => {
    showDeleteDialog(5);
    hideDeleteDialog();
    expect(state.currentDeleteIndex).toBe(null);
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('none');
  });
});
