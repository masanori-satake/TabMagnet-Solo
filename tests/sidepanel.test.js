import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '../projects/app/sidepanel.html'), 'utf8');

describe('sidepanel logic', () => {
  let chromeMock;

  beforeEach(() => {
    document.documentElement.innerHTML = html.toString();

    // Mock chrome APIs
    chromeMock = {
      i18n: {
        getMessage: jest.fn(key => key)
      },
      windows: {
        getCurrent: jest.fn().mockResolvedValue({ id: 1 })
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({})
        },
        onChanged: {
          addListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn().mockResolvedValue([]),
        group: jest.fn().mockResolvedValue(100),
        move: jest.fn().mockResolvedValue(),
        onActivated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() }
      },
      tabGroups: {
        query: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(),
        TAB_GROUP_ID_NONE: -1
      },
      runtime: {
        getManifest: jest.fn(() => ({ version: '9.9.9', author: 'Test' }))
      }
    };
    global.chrome = chromeMock;
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('init initializes the sidepanel', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();
    expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['targets', 'settings']);
  });

  test('UI interactions trigger storage updates', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Test settings switch
    const collectAllSwitch = document.getElementById('collect-all-groups-switch');
    collectAllSwitch.checked = true;
    collectAllSwitch.dispatchEvent(new Event('change'));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ collectFromAllGroups: true })
    }));
  });

  test('Add new target modal interaction', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    document.getElementById('add-new-btn').click();
    expect(document.getElementById('target-modal-scrim').style.display).toBe('flex');

    document.getElementById('new-name').value = 'Test Target';
    document.querySelector('.pattern-input').value = 'example.com';
    document.getElementById('save-target-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: expect.arrayContaining([
        expect.objectContaining({ name: 'Test Target' })
      ])
    }));
  });

  test('header layout and sync icon elements exist', () => {
    const settingsBtn = document.getElementById('settings-btn');
    expect(settingsBtn).not.toBeNull();
    expect(getComputedStyle(settingsBtn).marginLeft).toBe('auto');

    const syncIndicator = document.getElementById('sync-indicator');
    expect(syncIndicator).not.toBeNull();
    const svgPath = syncIndicator.querySelector('svg path');
    expect(svgPath).not.toBeNull();
    // Verify device sync icon path is used
    expect(svgPath.getAttribute('d')).toContain('M150-760h220q20');
  });

  test('importData validation rejects excessive targets or pattern length', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Trigger file import change event with excessive targets
    const fileInput = document.getElementById('file-input');
    const excessiveTargets = Array.from({ length: 101 }, (_, i) => ({
      name: `Target ${i}`,
      pattern: 'example.com'
    }));

    const file = new Blob([JSON.stringify({ targets: excessiveTargets })], { type: 'application/json' });
    const event = { target: { files: [file] } };

    // Mock FileReader
    class MockFileReader {
      readAsText(fileBlob) {
        setTimeout(() => {
          this.result = JSON.stringify({ targets: excessiveTargets });
          if (this.onload) this.onload({ target: { result: this.result } });
        }, 0);
      }
    }
    global.FileReader = jest.fn(() => new MockFileReader());

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    });
    fileInput.dispatchEvent(new Event('change'));

    // Verify error toast or handling
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(chromeMock.i18n.getMessage).toHaveBeenCalledWith('importError');
  });

  test('Delete target interaction', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'ToDelete', pattern: ['delete.me'] }]
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Click item to edit (skipping static Magnet All row)
    document.querySelector('.target-list-item:not([data-static="true"])').click();
    // Click delete in modal
    document.getElementById('delete-target-btn').click();
    // Click confirm in dialog
    document.getElementById('confirm-delete-ok-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: []
    }));
  });
});
