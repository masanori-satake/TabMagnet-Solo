import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAX_GROUP_SETS, MAX_GROUPS_PER_SET } from '../projects/app/ui/constants.js';

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

  test('グループ上限では専用メッセージに上限値を渡し保存しない', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    state.groupSets[0].groups = Array.from({ length: MAX_GROUPS_PER_SET }, () => ({
      name: 'Group', pattern: 'example.com'
    }));
    state.currentEdit = { setIndex: 0, groupIndex: null };
    document.getElementById('new-name').value = 'New';
    document.getElementById('pattern-list-container').innerHTML = '<input class="pattern-input" value="new.example">';
    chromeMock.storage.local.set.mockClear();

    document.getElementById('save-target-btn').click();

    expect(chromeMock.i18n.getMessage).toHaveBeenCalledWith('errorGroupLimit', [String(MAX_GROUPS_PER_SET)]);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    expect(state.groupSets[0].groups).toHaveLength(MAX_GROUPS_PER_SET);
  });

  test('空の新形式をインポートすると既定の1件を保存・表示する', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();
    chromeMock.storage.local.set.mockClear();
    document.querySelector('input[name="import-mode"][value="overwrite"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify({
      groupSets: [], targets: [{ name: 'Legacy', pattern: 'legacy.example' }]
    });

    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      groupSets: [{ name: 'defaultGroupSetName', color: 'grey', expanded: true, groups: [] }]
    });
    expect(document.querySelectorAll('.group-set-item')).toHaveLength(1);
    expect(document.querySelectorAll('.group-item')).toHaveLength(0);
  });

  test.each(['sync', 'local'])('空配列の変更通知でも既定の1件を表示する: %s', async (area) => {
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    state.settings.syncEnabled = true;
    const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];

    await listener({ groupSets: { newValue: [] } }, area);
    await Promise.resolve();

    expect(state.groupSets).toEqual([{ name: 'defaultGroupSetName', color: 'grey', expanded: true, groups: [] }]);
    expect(document.querySelectorAll('.group-set-item')).toHaveLength(1);
    if (area === 'sync') {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets: state.groupSets });
    }
  });

  test.each(['to_sync', 'from_sync'])('同期確定でも容量超過時は一切同期せずローカルを保持する: %s', async (direction) => {
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    const oversized = [{
      name: 'Large', color: 'grey', expanded: true,
      groups: [{ name: 'Group', pattern: Array(20).fill('a'.repeat(500)) }]
    }];
    if (direction === 'to_sync') state.groupSets = oversized;
    else chromeMock.storage.sync.get.mockResolvedValue({ groupSets: oversized });
    const previousGroupSets = state.groupSets;
    chromeMock.storage.local.set.mockClear();
    document.querySelector(`input[name="sync-settings-option"][value="${direction}"]`).checked = true;
    document.querySelector(`input[name="sync-targets-option"][value="${direction}"]`).checked = true;

    document.getElementById('confirm-sync-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    expect(state.groupSets).toBe(previousGroupSets);
    expect(state.settings.syncEnabled).toBe(false);
    expect(document.getElementById('toast').textContent).toBe('errorSyncSizeLimit');
  });

  test('同期確定では空の新形式を正規化し一度だけ同期する', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    chromeMock.storage.sync.get.mockResolvedValue({
      groupSets: [], targets: [{ name: 'Legacy', pattern: 'legacy.example' }]
    });
    document.querySelector('input[name="sync-settings-option"][value="to_sync"]').checked = true;
    document.querySelector('input[name="sync-targets-option"][value="from_sync"]').checked = true;

    document.getElementById('confirm-sync-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
      settings: expect.objectContaining({ syncEnabled: true }),
      groupSets: [{ name: 'defaultGroupSetName', color: 'grey', expanded: true, groups: [] }]
    });
    expect(state.settings.syncEnabled).toBe(true);
    expect(document.querySelectorAll('.group-set-item')).toHaveLength(1);
  });

  test('インポート成功時も同期容量超過の通知を保持する', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    const { state } = await import('../projects/app/ui/state.js');
    await init();
    state.settings.syncEnabled = true;
    const groupSets = [{
      name: 'Large', color: 'grey', expanded: true,
      groups: [{ name: 'Group', pattern: Array(20).fill('a'.repeat(500)) }]
    }];
    document.querySelector('input[name="import-mode"][value="overwrite"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify({ groupSets });

    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(state.groupSets).toEqual(groupSets);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets });
    expect(chromeMock.storage.sync.set).not.toHaveBeenCalledWith(expect.objectContaining({ groupSets: expect.anything() }));
    expect(document.getElementById('toast').textContent).toBe('errorSyncSizeLimit');
  });
});
