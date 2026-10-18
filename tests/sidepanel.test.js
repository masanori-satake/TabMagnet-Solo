import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_GROUP_SETS } from '../projects/app/ui/constants.js';

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
          set: jest.fn().mockResolvedValue({}),
          remove: jest.fn().mockResolvedValue({})
        },
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({}),
          remove: jest.fn().mockResolvedValue({})
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
    delete global.chrome;
    jest.resetModules();
  });

  test('init initializes the sidepanel', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();
    expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['groupSets', 'targets', 'settings']);
  });

  test('UI interactions trigger storage updates', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    const collectAllSwitch = document.getElementById('collect-all-groups-switch');
    collectAllSwitch.checked = true;
    collectAllSwitch.dispatchEvent(new Event('change'));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ collectFromAllGroups: true })
    }));
  });

  test('Add new Group-Set interaction', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    document.getElementById('add-group-set-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      groupSets: expect.arrayContaining([
        expect.objectContaining({ name: 'defaultGroupSetName' })
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
    expect(svgPath.getAttribute('d')).toContain('M150-760h220q20');
  });

  test('validateImportData accepts groupSets and settings', async () => {
    const { validateImportData } = await import('../projects/app/sidepanel.js');

    expect(() => validateImportData({
      groupSets: [{ name: 'Allowed Set', color: 'grey', expanded: true, groups: [] }],
      settings: { collapseAfterCollect: true, syncEnabled: false }
    })).not.toThrow();

    expect(() => validateImportData({
      groupSets: [{ name: 'Bad Set', color: 'grey', expanded: true, groups: [], badProp: 'no' }]
    })).toThrow('Invalid group-set property');
  });

  test('Property 13: Export formats data with groupSets and syncEnabled: false', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: [{ name: 'Test Set', color: 'grey', expanded: true, groups: [] }],
      settings: { collectFromAllGroups: true, syncEnabled: true }
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    let writeTextArg = null;
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(async (text) => {
          writeTextArg = text;
        })
      }
    });

    document.getElementById('copy-export-btn').click();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const exportedData = JSON.parse(writeTextArg);
    expect(exportedData.groupSets).toBeDefined();
    expect(exportedData.settings.syncEnabled).toBe(false);
    expect(exportedData.settings.collectFromAllGroups).toBe(true);
  });

  test('Property 14: Import append mode combines and overwrite mode replaces', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: [{ name: 'Existing Set', color: 'grey', expanded: true, groups: [] }],
      settings: { collectFromAllGroups: false, syncEnabled: true }
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    const importDataObj = {
      groupSets: [{ name: 'Imported Set', color: 'blue', expanded: true, groups: [] }],
      settings: { collectFromAllGroups: true, syncEnabled: false }
    };

    // Mode: append
    document.querySelector('input[name="import-mode"][value="append"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify(importDataObj);
    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      groupSets: [
        expect.objectContaining({ name: 'Existing Set' }),
        expect.objectContaining({ name: 'Imported Set' })
      ]
    }));

    // Mode: overwrite
    document.querySelector('input[name="import-mode"][value="overwrite"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify(importDataObj);
    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      groupSets: [
        expect.objectContaining({ name: 'Imported Set' })
      ]
    }));
  });

  test('Delete group interaction', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: [{
        name: 'Set 0', color: 'grey', expanded: true,
        groups: [{ name: 'ToDelete', pattern: ['delete.me'] }]
      }]
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Click Group item to edit
    const groupItem = document.querySelector('.group-item');
    expect(groupItem).toBeTruthy();
    groupItem.click();

    // Click delete in modal
    document.getElementById('delete-target-btn').click();
    // Click confirm in dialog
    document.getElementById('confirm-delete-ok-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      groupSets: [
        expect.objectContaining({ groups: [] })
      ]
    }));
  });

  test.each([
    ['新形式なし', {}],
    ['空の新形式あり', { groupSets: [] }],
    ['新形式あり', { groupSets: [{ name: 'Synced Set', color: 'blue', expanded: true, groups: [] }] }]
  ])('旧形式の同期では既存の新形式を優先する: %s', async (_label, syncData) => {
    const existingSets = [{ name: 'Existing Set', color: 'blue', expanded: true, groups: [] }];
    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: existingSets, settings: { syncEnabled: true }
    });
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    chromeMock.storage.local.set.mockClear();
    chromeMock.storage.sync.get.mockClear().mockResolvedValue(syncData);
    const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
    const targets = [{ name: 'Legacy', pattern: 'legacy.example/*', color: 'grey' }];

    await listener({ targets: { newValue: targets } }, 'sync');
    await Promise.resolve();

    expect(chromeMock.storage.sync.get).toHaveBeenCalledWith(['groupSets']);
    if (syncData.groupSets === undefined) {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        groupSets: [expect.objectContaining({ groups: targets })]
      });
      expect(document.querySelector('.group-item').textContent).toContain('Legacy');
    } else {
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
      expect(state.groupSets).toEqual(existingSets);
    }

    // バックグラウンドの旧キー削除イベントで移行済みデータを失わない。
    const currentSets = state.groupSets;
    await listener({ targets: { oldValue: targets, newValue: undefined } }, 'local');
    expect(state.groupSets).toBe(currentSets);
  });

  test.each([
    ['groupSets', MAX_GROUP_SETS - 1],
    ['groupSets', MAX_GROUP_SETS],
    ['targets', MAX_GROUP_SETS - 1],
    ['targets', MAX_GROUP_SETS]
  ])('追記インポートで保存後の総件数を検証する: %s、既存%i件', async (format, count) => {
    const existingSets = Array.from({ length: count }, (_, i) => ({
      name: `Set ${i}`, color: 'grey', expanded: true, groups: []
    }));
    chromeMock.storage.local.get.mockResolvedValue({ groupSets: existingSets });
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    chromeMock.storage.local.set.mockClear();
    const settingsBefore = { ...state.settings };
    const data = {
      [format]: format === 'groupSets'
        ? [{ name: 'Imported Set', color: 'blue', expanded: true, groups: [] }]
        : [{ name: 'Legacy', color: 'blue', pattern: 'legacy.example/*' }],
      settings: { collectFromAllGroups: !settingsBefore.collectFromAllGroups }
    };
    document.querySelector('input[name="import-mode"][value="append"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify(data);

    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    if (count === MAX_GROUP_SETS) {
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
      expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
      expect(state.groupSets).toEqual(existingSets);
      expect(state.settings).toEqual(settingsBefore);
      expect(document.getElementById('toast').textContent).toBe('importError');
    } else {
      expect(state.groupSets).toHaveLength(MAX_GROUP_SETS);
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets: state.groupSets });
      expect(state.settings.collectFromAllGroups).toBe(data.settings.collectFromAllGroups);
      expect(document.getElementById('toast').textContent).toBe('importSuccess');
    }
  });
});
