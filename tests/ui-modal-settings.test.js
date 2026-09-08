import { jest } from '@jest/globals';
import { state } from '../projects/app/ui/state.js';
import {
  renderSettingsUI,
  updateAboutInfo,
  showSettingsModal,
  hideSettingsModal,
  showSyncModal,
  hideSyncModal
} from '../projects/app/ui/modal-settings.js';

describe('ui/modal-settings.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="settings-modal-scrim" style="display: none;"></div>
      <div id="sync-modal-scrim" style="display: none;"></div>
      <button id="confirm-sync-btn"></button>
      <input type="radio" name="sync-settings-option" value="from_sync">
      <input type="radio" name="sync-settings-option" value="to_sync">
      <input type="radio" name="sync-targets-option" value="from_sync">
      <input type="radio" name="sync-targets-option" value="to_sync">
      <input type="checkbox" id="collect-all-groups-switch">
      <input type="checkbox" id="collapse-after-collect-switch">
      <div id="discard-tabs-container"></div>
      <input type="checkbox" id="discard-tabs-switch">
      <input type="checkbox" id="close-duplicate-tabs-switch">
      <input type="checkbox" id="keep-tm-order-switch">
      <input type="checkbox" id="sync-enabled-switch">
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
      collapseAfterCollect: false,
      syncEnabled: false
    };
    state.targets = [{}, {}];
  });

  test('show/hide sync modal', () => {
    const radio1 = document.querySelector('input[name="sync-settings-option"][value="from_sync"]');
    radio1.checked = true;

    showSyncModal();
    expect(document.getElementById('sync-modal-scrim').style.display).toBe('flex');
    expect(radio1.checked).toBe(false);
    expect(document.getElementById('confirm-sync-btn').classList.contains('disabled')).toBe(true);

    hideSyncModal();
    expect(document.getElementById('sync-modal-scrim').style.display).toBe('none');
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
