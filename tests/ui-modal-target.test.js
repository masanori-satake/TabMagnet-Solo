import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import {
  showTargetModal,
  hideTargetModal,
  addPatternInput,
  showModalFeedback,
  hideModalFeedback,
  selectColor,
  handlePatternDragOver
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
      <div class="color-option" data-color="red"></div>
      <div class="color-option" data-color="blue"></div>
    `;
    global.chrome = {
      i18n: { getMessage: jest.fn(key => key) }
    };
    state.targets = [{ name: 'Existing', pattern: ['test.com'], color: 'blue' }];
  });

  test('showTargetModal for new target', () => {
    showTargetModal(null);
    expect(document.getElementById('modal-title').textContent).toBe('addNew');
    expect(document.getElementById('target-modal-scrim').style.display).toBe('flex');
    expect(document.getElementById('delete-target-btn').classList.contains('hidden')).toBe(true);
  });

  test('showTargetModal for editing target', () => {
    showTargetModal(0);
    expect(document.getElementById('modal-title').textContent).toBe('edit');
    expect(document.getElementById('new-name').value).toBe('Existing');
    expect(document.getElementById('delete-target-btn').classList.contains('hidden')).toBe(false);
  });

  test('hideTargetModal', () => {
    showTargetModal();
    hideTargetModal();
    expect(document.getElementById('target-modal-scrim').style.display).toBe('none');
    expect(state.currentEditIndex).toBe(null);
  });

  test('addPatternInput adds item', () => {
    addPatternInput('example.com');
    const container = document.getElementById('pattern-list-container');
    expect(container.children.length).toBe(1);
    expect(container.querySelector('input').value).toBe('example.com');
  });

  test('selectColor updates state and UI', () => {
    selectColor('red');
    expect(state.selectedColor).toBe('red');
    expect(document.querySelector('.color-option[data-color="red"]').classList.contains('selected')).toBe(true);
  });

  test('show/hide feedback', () => {
    showModalFeedback('error');
    const feedback = document.getElementById('modal-feedback');
    expect(feedback.textContent).toBe('error');
    expect(feedback.classList.contains('hidden')).toBe(false);

    hideModalFeedback();
    expect(feedback.classList.contains('hidden')).toBe(true);
  });
});
