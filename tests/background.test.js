import { jest } from '@jest/globals';

describe('background auto-cleanup and renaming', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
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
});
