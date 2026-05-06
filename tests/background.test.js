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

  test('performAutoCleanup handles error when querying tabs', async () => {
    const { performAutoCleanup } = await import('../projects/app/background.js');
    const originalConsoleError = console.error;
    console.error = jest.fn();

    chromeMock.storage.local.get.mockResolvedValue({ targets: [{ name: 'Jira' }], protectedGroups: [] });
    chromeMock.tabGroups.query.mockResolvedValue([{ id: 1, title: '🧲Jira' }, { id: 2, title: '🧲Jira' }]);
    chromeMock.tabs.query.mockReturnValue(Promise.resolve([{ id: 101 }]));
    // Mock ungroup to fail
    chromeMock.tabs.ungroup.mockRejectedValue(new Error('Ungroup error'));

    try {
      await performAutoCleanup();
      // Error is logged in dissolveGroups (which is now in utils.js)
      expect(console.error).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
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

  test('listeners are registered', async () => {
    await import('../projects/app/background.js');

    expect(chromeMock.runtime.onStartup.addListener).toHaveBeenCalled();
    expect(chromeMock.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chromeMock.tabGroups.onRemoved.addListener).toHaveBeenCalled();
    expect(chromeMock.tabGroups.onUpdated.addListener).toHaveBeenCalled();
  });

  test('onInstalled sets sidepanel behavior', async () => {
    await import('../projects/app/background.js');
    const onInstalled = chromeMock.runtime.onInstalled.addListener.mock.calls[0][0];

    chromeMock.storage.local.get.mockResolvedValue({ targets: [] });
    await onInstalled();

    expect(chromeMock.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  test('onRemoved and onUpdated trigger checkAndRenameCollectingGroups', async () => {
    await import('../projects/app/background.js');
    const onRemoved = chromeMock.tabGroups.onRemoved.addListener.mock.calls[0][0];
    const onUpdated = chromeMock.tabGroups.onUpdated.addListener.mock.calls[0][0];

    chromeMock.tabGroups.query.mockResolvedValue([{ id: 1, title: '🧲Jira (Now Collecting)' }]);

    await onRemoved();
    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(1, { title: '🧲Jira' });

    chromeMock.tabGroups.update.mockClear();
    await onUpdated();
    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(1, { title: '🧲Jira' });
  });
});
