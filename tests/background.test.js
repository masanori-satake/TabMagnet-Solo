import { jest } from '@jest/globals';

describe('background auto-cleanup and renaming', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      i18n: {
        getMessage: jest.fn(key => key)
      },
      tabGroups: {
        query: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        onRemoved: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() }
      },
      tabs: {
        query: jest.fn(),
        ungroup: jest.fn().mockResolvedValue({})
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({}),
          remove: jest.fn().mockResolvedValue({})
        },
        sync: {
          get: jest.fn().mockResolvedValue({})
        },
        onChanged: {
          addListener: jest.fn()
        }
      },
      runtime: {
        onStartup: { addListener: jest.fn() },
        onInstalled: { addListener: jest.fn() }
      },
      sidePanel: {
        setPanelBehavior: jest.fn().mockResolvedValue({})
      }
    };
    global.chrome = chromeMock;
  });

  afterEach(() => {
    delete global.chrome;
    jest.resetModules();
  });

  test('performAutoCleanup should ungroup tabs if duplicate target groups exist in groupSets', async () => {
    const { performAutoCleanup } = await import('../projects/app/background.js');

    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: [{
        name: 'Set 1', color: 'grey', expanded: true,
        groups: [{ name: 'Jira', pattern: 'jira.example.com/*' }]
      }],
      protectedGroups: []
    });

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira' },
      { id: 2, title: '🧲Jira (Now Collecting)' }
    ]);

    chromeMock.tabs.query.mockImplementation(({ groupId }) => {
      if (groupId === 1) return Promise.resolve([{ id: 101 }]);
      if (groupId === 2) return Promise.resolve([{ id: 102 }]);
      return Promise.resolve([]);
    });

    await performAutoCleanup();

    expect(chromeMock.tabs.ungroup).toHaveBeenCalledWith([101]);
    expect(chromeMock.tabs.ungroup).toHaveBeenCalledWith([102]);
  });

  test('performAutoCleanup should not ungroup if only one group exists', async () => {
    const { performAutoCleanup } = await import('../projects/app/background.js');

    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: [{
        name: 'Set 1', color: 'grey', expanded: true,
        groups: [{ name: 'Jira', pattern: 'jira.example.com/*' }]
      }],
      protectedGroups: []
    });

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira' }
    ]);

    await performAutoCleanup();

    expect(chromeMock.tabs.ungroup).not.toHaveBeenCalled();
  });

  test('performAutoCleanup should respect protectedGroups', async () => {
    const { performAutoCleanup } = await import('../projects/app/background.js');

    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: [{
        name: 'Set 1', color: 'grey', expanded: true,
        groups: [{ name: 'Jira', pattern: 'jira.example.com/*' }]
      }],
      protectedGroups: ['🧲Jira']
    });

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira' },
      { id: 2, title: '🧲Jira (Now Collecting)' }
    ]);

    await performAutoCleanup();

    expect(chromeMock.tabs.ungroup).not.toHaveBeenCalled();
  });

  test('checkAndRenameCollectingGroups should rename if no conflict', async () => {
    const { checkAndRenameCollectingGroups } = await import('../projects/app/background.js');

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira (Now Collecting)' }
    ]);

    await checkAndRenameCollectingGroups();

    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(1, { title: '🧲Jira' });
  });

  test('listeners are registered', async () => {
    await import('../projects/app/background.js');

    expect(chromeMock.runtime.onStartup.addListener).toHaveBeenCalled();
    expect(chromeMock.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chromeMock.tabGroups.onRemoved.addListener).toHaveBeenCalled();
    expect(chromeMock.tabGroups.onUpdated.addListener).toHaveBeenCalled();
  });

  test('chrome.storage.onChanged handles sync area groupSets in background when syncEnabled', async () => {
    chromeMock.storage.local.set = jest.fn().mockResolvedValue({});
    chromeMock.storage.local.get.mockResolvedValue({
      settings: { syncEnabled: true }
    });

    await import('../projects/app/background.js');
    const onChangedListener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];

    const changes = {
      groupSets: {
        newValue: [{
          name: 'SyncedSet', color: 'blue', expanded: true,
          groups: [{ name: 'SyncedTarget', pattern: ['example.com/*'], color: 'blue' }]
        }]
      },
      settings: { newValue: { collectFromAllGroups: true } }
    };

    await onChangedListener(changes, 'sync');

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      groupSets: changes.groupSets.newValue,
      settings: expect.objectContaining({
        collectFromAllGroups: true,
        syncEnabled: true
      })
    });
  });

  test.each([
    ['新形式なし', {}],
    ['空の新形式あり', { groupSets: [] }],
    ['新形式あり', { groupSets: [{ name: 'Synced Set', color: 'blue', expanded: true, groups: [] }] }]
  ])('旧形式の同期では既存の新形式を優先する: %s', async (_label, syncData) => {
    chromeMock.storage.local.get.mockResolvedValue({ settings: { syncEnabled: true } });
    chromeMock.storage.sync.get.mockResolvedValue(syncData);
    await import('../projects/app/background.js');
    const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
    const targets = [{ name: 'Legacy', pattern: 'legacy.example/*', color: 'grey' }];

    await listener({ targets: { newValue: targets } }, 'sync');

    expect(chromeMock.storage.sync.get).toHaveBeenCalledWith(['groupSets']);
    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(['targets']);
    if (syncData.groupSets === undefined) {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        groupSets: [expect.objectContaining({ groups: targets })]
      });
    } else {
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    }
  });

  test('旧形式の同期キー削除時もローカルの旧形式を削除する', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ settings: { syncEnabled: true } });
    await import('../projects/app/background.js');
    const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];

    await listener({ targets: { oldValue: [], newValue: undefined } }, 'sync');

    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(['targets']);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });
});
