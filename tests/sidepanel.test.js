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
        getManifest: jest.fn(() => ({ version: '1.5.3', author: 'Test' }))
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

  test('Delete target interaction', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'ToDelete', pattern: ['delete.me'] }]
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Click item to edit
    document.querySelector('.target-list-item').click();
    // Click delete in modal
    document.getElementById('delete-target-btn').click();
    // Click confirm in dialog
    document.getElementById('confirm-delete-ok-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: []
    }));
  });
});
