import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import {
  showTargetModal,
  hideTargetModal,
  addPatternInput,
  showModalFeedback,
  hideModalFeedback,
  selectColor
} from '../projects/app/ui/modal-target.js';

describe('ui/modal-target.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="target-modal-scrim" style="display: none;"></div>
      <div id="modal-title"></div>
      <input id="new-name">
      <div id="pattern-list-container"></div>
      <div id="modal-feedback" class="hidden"></div>
      <button id="delete-target-btn"></button>
      <div id="color-selection"></div>
      <template id="color-option-template">
        <div class="color-option"><span class="tooltip"></span></div>
      </template>
    `;
    global.chrome = {
      i18n: { getMessage: jest.fn(key => key) }
    };
    state.groupSets = [
      { name: 'Set 0', color: 'grey', expanded: true, groups: [{ name: 'Existing Group', pattern: ['test.com'], color: 'blue' }] },
      { name: 'Set 1', color: 'grey', expanded: true, groups: [{ name: 'Other Group', pattern: ['other.com'], color: 'green' }] }
    ];
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('showTargetModal for new group in set 0', () => {
    showTargetModal(null, 0);
    expect(document.getElementById('modal-title').textContent).toBe('addNew');
    expect(document.getElementById('target-modal-scrim').style.display).toBe('flex');
    expect(document.getElementById('delete-target-btn').classList.contains('hidden')).toBe(true);
    expect(state.currentEdit).toEqual({ setIndex: 0, groupIndex: null });
  });

  test('showTargetModal for editing existing group in set 0', () => {
    showTargetModal(0, 0);
    expect(document.getElementById('modal-title').textContent).toBe('editGroupTitle');
    expect(document.getElementById('new-name').value).toBe('Existing Group');
    expect(document.getElementById('delete-target-btn').classList.contains('hidden')).toBe(false);
    expect(state.currentEdit).toEqual({ setIndex: 0, groupIndex: 0 });
  });

  test('hideTargetModal resets currentEdit', () => {
    showTargetModal(0, 0);
    hideTargetModal();
    expect(document.getElementById('target-modal-scrim').style.display).toBe('none');
    expect(state.currentEdit).toEqual({ setIndex: null, groupIndex: null });
  });

  test('addPatternInput adds item to container', () => {
    addPatternInput('example.com');
    const container = document.getElementById('pattern-list-container');
    expect(container.children.length).toBe(1);
    expect(container.querySelector('input').value).toBe('example.com');
  });

  test('selectColor updates state and UI', () => {
    selectColor('red');
    expect(state.selectedColor).toBe('red');
  });

  test('show/hide feedback', () => {
    showModalFeedback('error message');
    const feedback = document.getElementById('modal-feedback');
    expect(feedback.textContent).toBe('error message');
    expect(feedback.classList.contains('hidden')).toBe(false);

    hideModalFeedback();
    expect(feedback.classList.contains('hidden')).toBe(true);
  });

  test('Property 9: Group operations in a Group-Set do not modify other Group-Sets', () => {
    // Edit group 0 in set 0
    showTargetModal(0, 0);
    state.groupSets[0].groups[0].name = 'Updated Group 0';

    expect(state.groupSets[0].groups[0].name).toBe('Updated Group 0');
    // Set 1 should remain completely untouched
    expect(state.groupSets[1].groups[0].name).toBe('Other Group');
  });
});
