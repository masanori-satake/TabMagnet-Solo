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
          get: jest.fn()
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

  test('performAutoCleanup should ungroup tabs if duplicate target groups exist', async () => {
    const { performAutoCleanup } = await import('../projects/app/background.js');

    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Jira' }],
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
      targets: [{ name: 'Jira' }],
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
      targets: [{ name: 'Jira' }],
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

  test('checkAndRenameCollectingGroups should not rename if conflict exists', async () => {
    const { checkAndRenameCollectingGroups } = await import('../projects/app/background.js');

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira (Now Collecting)' },
      { id: 2, title: '🧲Jira' }
    ]);

    await checkAndRenameCollectingGroups();

    expect(chromeMock.tabGroups.update).not.toHaveBeenCalled();
  });

  test('checkAndRenameCollectingGroups should handle multiple groups', async () => {
    const { checkAndRenameCollectingGroups } = await import('../projects/app/background.js');

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira (Now Collecting)' },
      { id: 2, title: '🧲Github (Now Collecting)' }
    ]);

    await checkAndRenameCollectingGroups();

    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(1, { title: '🧲Jira' });
    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(2, { title: '🧲Github' });
  });

  test('checkAndRenameCollectingGroups should handle error in update gracefully', async () => {
    const { checkAndRenameCollectingGroups } = await import('../projects/app/background.js');

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Jira (Now Collecting)' }
    ]);
    chromeMock.tabGroups.update.mockRejectedValue(new Error('Update failed'));

    await checkAndRenameCollectingGroups();
    // Should not throw
  });

  test('checkAndRenameCollectingGroups should prioritize the group with smaller ID when multiple Collecting groups exist', async () => {
    const { checkAndRenameCollectingGroups } = await import('../projects/app/background.js');

    // Simulate multiple collecting groups for the same target
    // ID 1 should be finalized, ID 2 should stay as is
    chromeMock.tabGroups.query
      .mockResolvedValueOnce([
        { id: 1, title: '🧲Jira (Now Collecting)' },
        { id: 2, title: '🧲Jira (Now Collecting)' }
      ])
      // Second call (inside loop for ID 1)
      .mockResolvedValueOnce([
        { id: 1, title: '🧲Jira (Now Collecting)' },
        { id: 2, title: '🧲Jira (Now Collecting)' }
      ])
      // Third call (inside loop for ID 2)
      .mockResolvedValueOnce([
        { id: 1, title: '🧲Jira' }, // ID 1 was finalized
        { id: 2, title: '🧲Jira (Now Collecting)' }
      ]);

    await checkAndRenameCollectingGroups();

    // Should only finalize group 1
    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(1, { title: '🧲Jira' });
    expect(chromeMock.tabGroups.update).not.toHaveBeenCalledWith(2, expect.anything());
  });
});
