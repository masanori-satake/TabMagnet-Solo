import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import {
  renderSettingsUI,
  updateAboutInfo,
  showSettingsModal,
  hideSettingsModal
} from '../projects/app/ui/modal-settings.js';

describe('ui/modal-settings.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="settings-modal-scrim" style="display: none;"></div>
      <input type="checkbox" id="collect-all-groups-switch">
      <input type="checkbox" id="collapse-after-collect-switch">
      <div id="discard-tabs-container"></div>
      <input type="checkbox" id="discard-tabs-switch">
      <input type="checkbox" id="close-duplicate-tabs-switch">
      <input type="checkbox" id="keep-tm-order-switch">
      <div id="about-version"></div>
      <div id="about-developer"></div>
      <div id="about-target-count"></div>
    `;
    global.chrome = {
      runtime: {
        getManifest: jest.fn(() => ({ version: '9.9.9', author: 'Author' }))
      }
    };
    state.settings = {
      collectFromAllGroups: true,
      collapseAfterCollect: false
    };
    state.targets = [{}, {}];
  });

  test('renderSettingsUI updates switches', () => {
    renderSettingsUI();
    expect(document.getElementById('collect-all-groups-switch').checked).toBe(true);
    expect(document.getElementById('collapse-after-collect-switch').checked).toBe(false);
    expect(document.getElementById('discard-tabs-container').classList.contains('disabled')).toBe(true);
  });

  test('updateAboutInfo updates info', () => {
    updateAboutInfo();
    expect(document.getElementById('about-version').textContent).toBe('v9.9.9');
    expect(document.getElementById('about-target-count').textContent).toBe('2');
  });

  test('show/hide settings modal', () => {
    showSettingsModal();
    expect(document.getElementById('settings-modal-scrim').style.display).toBe('flex');
    hideSettingsModal();
    expect(document.getElementById('settings-modal-scrim').style.display).toBe('none');
  });
});
