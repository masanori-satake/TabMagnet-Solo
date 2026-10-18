import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import { MAX_GROUP_SET_NAME_LENGTH } from '../projects/app/ui/constants.js';
import {
  toggleGroupSetExpanded,
  moveGroupSet,
  deleteGroupSet,
  addGroupSet,
  saveGroupSet,
  updateEditMenuButtonStates,
  updateGroupSetDeleteButtonState,
  showGroupSetModal
} from '../projects/app/ui/group-set.js';

describe('group-set.js operations and correctness properties', () => {
  let chromeMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gs-edit-menu-scrim" style="display: none;"></div>
      <button id="gs-edit-menu-add-group"></button>
      <button id="gs-edit-menu-add-from-domain"></button>
      <button id="gs-edit-menu-move-up"></button>
      <button id="gs-edit-menu-move-down"></button>
      <div id="gs-edit-modal-scrim" style="display: none;"></div>
      <input id="gs-edit-name">
      <div id="gs-color-selection"></div>
      <div id="gs-modal-feedback" class="hidden"></div>
      <button id="delete-group-set-btn"></button>
      <div id="delete-dialog-scrim" style="display: none;">
        <div class="dialog-text"></div>
      </div>
      <template id="color-option-template">
        <div class="color-option"><span class="tooltip"></span></div>
      </template>
    `;

    chromeMock = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn().mockResolvedValue({})
        }
      },
      i18n: {
        getMessage: jest.fn(key => key)
      },
      tabs: {
        query: jest.fn().mockResolvedValue([{ url: 'https://example.com' }])
      }
    };
    global.chrome = chromeMock;

    state.groupSets = [
      { name: 'Set 0', color: 'grey', expanded: true, groups: [] },
      { name: 'Set 1', color: 'blue', expanded: false, groups: [] }
    ];
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('Property 5: toggleGroupSetExpanded is an involution', async () => {
    const initialExpanded = state.groupSets[0].expanded;

    await toggleGroupSetExpanded(0);
    expect(state.groupSets[0].expanded).toBe(!initialExpanded);

    await toggleGroupSetExpanded(0);
    expect(state.groupSets[0].expanded).toBe(initialExpanded);
  });

  test('Property 6: Empty or whitespace-only Group-Set name is rejected on save', async () => {
    state.currentEditSetIndex = 0;
    const nameInput = document.getElementById('gs-edit-name');

    // Whitespace string
    nameInput.value = '   ';
    await saveGroupSet(0);

    const feedback = document.getElementById('gs-modal-feedback');
    expect(feedback.classList.contains('hidden')).toBe(false);
    expect(state.groupSets[0].name).toBe('Set 0'); // unchanged
  });

  test('Property 7: deleteGroupSet opens dialog when count >= 2', () => {
    deleteGroupSet(0);
    expect(state.currentDelete).toEqual({ type: 'groupSet', setIndex: 0 });
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('flex');
  });

  test.each([MAX_GROUP_SET_NAME_LENGTH - 1, MAX_GROUP_SET_NAME_LENGTH])('上限内の名前をトリムして保存する: %i文字', async (length) => {
    const name = 'あ'.repeat(length);
    document.getElementById('gs-edit-name').value = `  ${name}  `;
    state.selectedSetColor = 'red';

    await saveGroupSet(0);

    expect(state.groupSets[0]).toEqual(expect.objectContaining({ name, color: 'red' }));
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets: state.groupSets });
    expect(document.getElementById('gs-modal-feedback').classList.contains('hidden')).toBe(true);
  });

  test('文字数上限を超える名前はフィードバックを表示して保存を中止する', async () => {
    document.getElementById('gs-edit-name').value = 'あ'.repeat(MAX_GROUP_SET_NAME_LENGTH + 1);
    document.getElementById('gs-edit-modal-scrim').style.display = 'flex';
    state.selectedSetColor = 'red';

    await saveGroupSet(0);

    expect(state.groupSets[0]).toEqual(expect.objectContaining({ name: 'Set 0', color: 'grey' }));
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    expect(document.getElementById('gs-modal-feedback').textContent).toBe('errorGroupSetNameTooLong');
    expect(document.getElementById('gs-modal-feedback').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('gs-edit-modal-scrim').style.display).toBe('flex');
  });

  test('deleteGroupSet does nothing when count === 1', () => {
    state.groupSets = [{ name: 'Only Set', color: 'grey', expanded: true, groups: [] }];
    deleteGroupSet(0);
    expect(document.getElementById('delete-dialog-scrim').style.display).toBe('none');
  });

  test('Property 8: moveGroupSet swaps position and preserves element set', async () => {
    await moveGroupSet(0, 1); // Move Set 0 down to index 1
    expect(state.groupSets[0].name).toBe('Set 1');
    expect(state.groupSets[1].name).toBe('Set 0');

    await moveGroupSet(1, -1); // Move Set 0 back up to index 0
    expect(state.groupSets[0].name).toBe('Set 0');
    expect(state.groupSets[1].name).toBe('Set 1');
  });

  test('Property 16: addGroupSet respects MAX_GROUP_SETS (20)', async () => {
    state.groupSets = Array.from({ length: 20 }, (_, i) => ({
      name: `Set ${i}`, color: 'grey', expanded: true, groups: []
    }));

    await addGroupSet();
    expect(state.groupSets.length).toBe(20);
  });

  test('updateEditMenuButtonStates disables move buttons at list boundaries', async () => {
    await updateEditMenuButtonStates(0);
    const moveUpBtn = document.getElementById('gs-edit-menu-move-up');
    const moveDownBtn = document.getElementById('gs-edit-menu-move-down');

    expect(moveUpBtn.disabled).toBe(true);
    expect(moveDownBtn.disabled).toBe(false);
  });

  test('updateGroupSetDeleteButtonState disables delete button when only 1 set exists', () => {
    state.groupSets = [{ name: 'Single Set', color: 'grey', expanded: true, groups: [] }];
    updateGroupSetDeleteButtonState();
    const deleteBtn = document.getElementById('delete-group-set-btn');
    expect(deleteBtn.disabled).toBe(true);
  });
});
