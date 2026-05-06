import { jest } from '@jest/globals';
import { matchUrl, getTimestamp, getExportTimestamp } from '../projects/app/ui/utils.js';

describe('matchUrl', () => {
  test('basic prefix match', () => {
    expect(matchUrl('https://jira.example.com/browse/PROJ-1', 'jira.example.com')).toBe(true);
  });

  test('wildcard match', () => {
    expect(matchUrl('https://jira.example.com/browse/PROJ-1', 'jira.example.com/*/PROJ-*')).toBe(true);
    expect(matchUrl('https://github.com/masanori-satake/TabMagnet-Solo', 'github.com/*/TabMagnet-Solo')).toBe(true);
  });

  test('no protocol match', () => {
    expect(matchUrl('http://example.com', 'example.com')).toBe(true);
    expect(matchUrl('https://example.com', 'example.com')).toBe(true);
  });

  test('non-matching', () => {
    expect(matchUrl('https://google.com', 'example.com')).toBe(false);
  });

  test('special characters match', () => {
    // ? should be treated as literal if it's in the pattern
    expect(matchUrl('https://example.com/search?q=1', 'example.com/search?q=1')).toBe(true);
    // . should be escaped
    expect(matchUrl('https://example.com/a.b', 'example.com/a.b')).toBe(true);
    expect(matchUrl('https://example.com/axb', 'example.com/a.b')).toBe(false);
  });

  test('normalization test', () => {
    expect(matchUrl('https://example.com/path', 'https://example.com/*')).toBe(true);
    expect(matchUrl('https://example.com/path', 'http://example.com/*')).toBe(true);
    // Regression test for: notebooklm.google.com/* should match https://notebooklm.google.com/
    expect(matchUrl('https://notebooklm.google.com/', 'notebooklm.google.com/*')).toBe(true);
  });
});

describe('getTimestamp', () => {
  test('format check', () => {
    const ts = getTimestamp();
    expect(ts).toMatch(/^\d{8}_\d{6}$/);
  });
});

describe('getExportTimestamp', () => {
  test('format check', () => {
    const ts = getExportTimestamp();
    // YYMMDD_hhmm
    expect(ts).toMatch(/^\d{6}_\d{4}$/);
  });
});

describe('executeMagnet naming and protection', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      windows: {
        getCurrent: jest.fn().mockResolvedValue({ id: 1 })
      },
      tabs: {
        query: jest.fn(),
        move: jest.fn().mockResolvedValue(),
        remove: jest.fn().mockResolvedValue(),
        group: jest.fn().mockResolvedValue(100),
        ungroup: jest.fn().mockResolvedValue()
      },
      tabGroups: {
        query: jest.fn(),
        update: jest.fn().mockResolvedValue(),
        TAB_GROUP_ID_NONE: -1
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({})
        }
      }
    };
    global.chrome = chromeMock;
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('should collect matching tabs and name them with _TM suffix when no duplicates exist', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 },
      { id: 11, url: 'https://jira.example.com/2', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([]);

    await executeMagnet(target);

    expect(chromeMock.tabs.group).toHaveBeenCalledWith({ tabIds: [10, 11] });
    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(100, { title: '🧲Jira (Now Collecting)' });
    expect(chromeMock.tabGroups.update).toHaveBeenLastCalledWith(100, { title: '🧲Jira' });
  });

  test('should keep  (Now Collecting) if another 🧲 group exists', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 200, title: '🧲Jira' }
    ]);

    await executeMagnet(target);

    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(100, { title: '🧲Jira (Now Collecting)' });
    expect(chromeMock.tabGroups.update).not.toHaveBeenCalledWith(100, { title: '🧲Jira' });
  });

  test('should protect groups without 🧲 prefix', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/protected', groupId: 50 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 50, title: 'My Manual Group' }
    ]);

    await executeMagnet(target);

    expect(chromeMock.tabs.group).not.toHaveBeenCalled();
  });

  test('should collect from unprotected groups if collectFromAllGroups is true', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { collectFromAllGroups: true }
    });

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/not-protected-now', groupId: 50 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 50, title: 'My Manual Group' }
    ]);

    await executeMagnet(target);

    expect(chromeMock.tabs.group).toHaveBeenCalledWith({ tabIds: [10] });
  });

  test('should collapse group after collection if collapseAfterCollect is true', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { collapseAfterCollect: true }
    });

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([]);

    await executeMagnet(target);

    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(100, expect.objectContaining({ collapsed: true }));
  });

  test('should set group color if target has color', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*', color: 'blue' };

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([]);

    await executeMagnet(target);

    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(100, expect.objectContaining({ color: 'blue' }));
  });

  test('should handle empty tab collection gracefully', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockResolvedValue([]);
    chromeMock.tabGroups.query.mockResolvedValue([]);

    await executeMagnet(target);

    expect(chromeMock.tabs.group).not.toHaveBeenCalled();
  });

  test('should handle error in executeMagnet gracefully', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockRejectedValue(new Error('Query failed'));

    await expect(executeMagnet(target)).rejects.toThrow('Query failed');
  });

  test('should close duplicate tabs if closeDuplicateTabs is true', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { closeDuplicateTabs: true }
    });

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 },
      { id: 11, url: 'https://jira.example.com/1', groupId: -1 },
      { id: 12, url: 'https://jira.example.com/2', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([]);

    await executeMagnet(target);

    expect(chromeMock.tabs.remove).toHaveBeenCalledWith([11]);
    expect(chromeMock.tabs.group).toHaveBeenCalledWith({ tabIds: [10, 12] });
  });

  test('should NOT close duplicates if they are in protected groups', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { closeDuplicateTabs: true, collectFromAllGroups: false }
    });

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: 50 }, // protected
      { id: 11, url: 'https://jira.example.com/1', groupId: -1 }  // would be duplicate but first is protected
    ]);
    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 50, title: 'My Manual Group' }
    ]);

    await executeMagnet(target);

    expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
    expect(chromeMock.tabs.group).toHaveBeenCalledWith({ tabIds: [11] });
  });

  test('should dissolve existing groups if no tabs match', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 200, title: '🧲Jira' }
    ]);

    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (query.groupId === 200) return [{ id: 15, groupId: 200 }];
      if (Object.keys(query).length === 0) {
        return [
          { id: 20, url: 'https://other.com', groupId: -1 },
          { id: 15, url: 'https://jira.example.com/1', groupId: 200 }
        ];
      }
      return [];
    });

    await executeMagnet(target);

    expect(chromeMock.tabs.ungroup).toHaveBeenCalledWith([15]);
  });

  test('should ungroup non-matching tabs from target group before dissolving', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) {
        return [
          { id: 10, url: 'https://jira.example.com/1', groupId: 200 },
          { id: 11, url: 'https://other.com', groupId: 200 }
        ];
      }
      if (query.groupId === 200) {
        return [
          { id: 10, url: 'https://jira.example.com/1', groupId: 200 },
          { id: 11, url: 'https://other.com', groupId: 200 }
        ];
      }
      return [];
    });
    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 200, title: '🧲Jira' }
    ]);

    await executeMagnet(target);

    expect(chromeMock.tabs.ungroup).toHaveBeenCalledWith([11]);
  });

  test('should rename to final name if no conflict with other groups', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValueOnce([]) // initial
                                .mockResolvedValueOnce([{ id: 100, title: '🧲Jira (Now Collecting)' }]); // after check

    await executeMagnet(target);

    expect(chromeMock.tabGroups.update).toHaveBeenCalledWith(100, { title: '🧲Jira' });
  });

  test('should handle conflict with earlier Collecting group', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://jira.example.com/1', groupId: -1 }
    ]);
    chromeMock.tabGroups.query.mockResolvedValueOnce([]) // initial
                                .mockResolvedValueOnce([
                                  { id: 100, title: '🧲Jira (Now Collecting)' },
                                  { id: 50, title: '🧲Jira (Now Collecting)' }
                                ]);

    await executeMagnet(target);

    // Should NOT rename to 🧲Jira because ID 50 is smaller
    expect(chromeMock.tabGroups.update).not.toHaveBeenCalledWith(100, { title: '🧲Jira' });
  });

  test('should handle update error when renaming group', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };
    console.warn = jest.fn();

    chromeMock.tabs.query.mockResolvedValue([{ id: 10, url: 'https://jira.example.com/1', groupId: -1 }]);
    chromeMock.tabGroups.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 100, title: '🧲Jira (Now Collecting)' }]);
    chromeMock.tabGroups.update.mockImplementation((id, data) => {
      if (data.title === '🧲Jira') return Promise.reject(new Error('Rename error'));
      return Promise.resolve();
    });

    await executeMagnet(target);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to update group title: Rename error'));
  });

  test('should discard tabs if discardTabsAfterCollect is true', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { collapseAfterCollect: true, discardTabsAfterCollect: true }
    });
    // For allGroups in the loop and after check
    chromeMock.tabGroups.query.mockResolvedValue([]);

    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) return [{ id: 10, url: 'https://jira.example.com/1', groupId: -1 }];
      if (query.groupId === 100) return [{ id: 10, url: 'https://jira.example.com/1', groupId: 100, discarded: false }];
      if (query.active && query.windowId === 1) return [{ id: 20 }]; // active tab is different
      return [];
    });
    chromeMock.tabGroups.query.mockResolvedValue([]);
    chromeMock.tabs.discard = jest.fn().mockResolvedValue();

    await executeMagnet(target);

    expect(chromeMock.tabs.discard).toHaveBeenCalledWith(10);
  });

  test('should NOT discard active tab', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { collapseAfterCollect: true, discardTabsAfterCollect: true }
    });
    chromeMock.tabGroups.query.mockResolvedValue([]);

    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) return [{ id: 10, url: 'https://jira.example.com/1', groupId: -1 }];
      if (query.groupId === 100) return [{ id: 10, url: 'https://jira.example.com/1', groupId: 100, discarded: false }];
      if (query.active && query.windowId === 1) return [{ id: 10 }]; // active tab is the same
      return [];
    });
    chromeMock.tabs.discard = jest.fn();

    await executeMagnet(target);

    expect(chromeMock.tabs.discard).not.toHaveBeenCalled();
  });

  test('should handle discard error gracefully', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };
    console.warn = jest.fn();

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { collapseAfterCollect: true, discardTabsAfterCollect: true }
    });
    chromeMock.tabGroups.query.mockResolvedValue([]);

    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) return [{ id: 10, url: 'https://jira.example.com/1', groupId: -1 }];
      if (query.groupId === 100) return [{ id: 10, discarded: false }];
      if (query.active && query.windowId === 1) return [{ id: 20 }];
      return [];
    });
    chromeMock.tabs.discard = jest.fn().mockRejectedValue(new Error('Discard failed'));

    await executeMagnet(target);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to discard tab 10'));
  });

  test('should skip discard if tab already discarded', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { collapseAfterCollect: true, discardTabsAfterCollect: true }
    });
    chromeMock.tabGroups.query.mockResolvedValue([]);

    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) return [{ id: 10, url: 'https://jira.example.com/1', groupId: -1 }];
      if (query.groupId === 100) return [{ id: 10, discarded: true }];
      if (query.active && query.windowId === 1) return [{ id: 20 }];
      return [];
    });
    chromeMock.tabs.discard = jest.fn();

    await executeMagnet(target);

    expect(chromeMock.tabs.discard).not.toHaveBeenCalled();
  });

  test('should call maintainTMOrder if keepTMOrder is true', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };

    chromeMock.storage.local.get.mockResolvedValue({
      settings: { keepTMOrder: true },
      targets: [{ name: 'Jira' }]
    });
    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) return [{ id: 10, url: 'https://jira.example.com/1', groupId: -1 }];
      return [];
    });
    chromeMock.tabGroups.query.mockImplementation(async (query) => {
      if (query && query.windowId === 1) return [{ id: 100, title: '🧲Jira', windowId: 1 }];
      return [];
    });
    chromeMock.tabGroups.move = jest.fn().mockResolvedValue();

    await executeMagnet(target);

    expect(chromeMock.tabGroups.move).toHaveBeenCalled();
  });

  test('should handle dissolve error gracefully', async () => {
    const { executeMagnet } = await import('../projects/app/ui/utils.js');
    const target = { name: 'Jira', pattern: 'jira.example.com/*' };
    const originalConsoleError = console.error;
    console.error = jest.fn();

    chromeMock.tabGroups.query.mockResolvedValue([{ id: 200, title: '🧲Jira' }]);

    // Trigger dissolveGroups(groupsToDissolve) by having no matching tabs initially,
    // but group 200 is 🧲Jira and it should be identified for dissolution if it were targeted.
    // Wait, the logic only adds to groupsToDissolve if it matches target.name.

    chromeMock.tabs.query.mockImplementation(async (query) => {
      // 1. query({}) -> allTabs
      if (Object.keys(query).length === 0) {
        return [
          { id: 10, url: 'https://jira.example.com/1', groupId: 200 }
        ];
      }
      // 2. query({groupId: 200}) -> tabsInGroup (inside dissolveGroups)
      if (query.groupId === 200) return [{ id: 10, groupId: 200 }];
      return [];
    });

    chromeMock.tabs.ungroup = jest.fn().mockRejectedValue(new Error('Ungroup error'));

    // To hit line 171, matchedTabs.length must be 0.
    // matchedTabs is 0 if no tab matches or all matches are protected.
    // If tab 10 matches jira.example.com/1 but group 200 is protected...
    // But 🧲Jira is NOT protected.
    // To make matchedTabs.length === 0, let's make the tab URL not match.
    chromeMock.tabs.query.mockImplementation(async (query) => {
      if (Object.keys(query).length === 0) {
        return [{ id: 10, url: 'https://other.com', groupId: 200 }];
      }
      if (query.groupId === 200) return [{ id: 10, groupId: 200 }];
      return [];
    });
    // If group 200 title is 🧲Jira, and target is Jira, it will be added to groupsToDissolve.

    try {
      await executeMagnet(target);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to dissolve group 200'), expect.any(Error));
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe('maintainTMOrder', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      tabGroups: {
        query: jest.fn(),
        move: jest.fn().mockResolvedValue()
      },
      storage: {
        local: {
          get: jest.fn()
        }
      }
    };
    global.chrome = chromeMock;
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('should reorder groups according to target list', async () => {
    const { maintainTMOrder } = await import('../projects/app/ui/utils.js');

    chromeMock.storage.local.get.mockResolvedValue({
      targets: [
        { name: 'Jira' },
        { name: 'Github' }
      ]
    });

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 1, title: '🧲Github', windowId: 1 },
      { id: 2, title: '🧲Jira', windowId: 1 },
      { id: 3, title: 'Other', windowId: 1 },
      { id: 4, title: '🧲Orphan', windowId: 1 }
    ]);

    await maintainTMOrder(1);

    // Expected move order:
    // 1. Orphan (4)
    // 2. Jira (2)
    // 3. Github (1)
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(1, 4, { index: -1 });
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(2, 2, { index: -1 });
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(3, 1, { index: -1 });
  });

  test('should handle collecting groups and prioritization', async () => {
    const { maintainTMOrder } = await import('../projects/app/ui/utils.js');

    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Jira' }]
    });

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 2, title: '🧲Jira', windowId: 1 },
      { id: 1, title: '🧲Jira (Now Collecting)', windowId: 1 }
    ]);

    await maintainTMOrder(1);

    // For Jira: 1 (Collecting) is moved first, then 2 (Regular) is moved.
    // Result order: [..., 1, 2]
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(1, 1, { index: -1 });
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(2, 2, { index: -1 });
  });

  test('should sort by ID if groups are of the same type', async () => {
    const { maintainTMOrder } = await import('../projects/app/ui/utils.js');

    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Jira' }]
    });

    chromeMock.tabGroups.query.mockResolvedValue([
      { id: 20, title: '🧲Jira', windowId: 1 },
      { id: 10, title: '🧲Jira', windowId: 1 }
    ]);

    await maintainTMOrder(1);

    // ID 10 moved first, then ID 20
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(1, 10, { index: -1 });
    expect(chromeMock.tabGroups.move).toHaveBeenNthCalledWith(2, 20, { index: -1 });
  });

  test('should handle move error gracefully', async () => {
    const { maintainTMOrder } = await import('../projects/app/ui/utils.js');
    console.warn = jest.fn();

    chromeMock.storage.local.get.mockResolvedValue({ targets: [{ name: 'Jira' }] });
    chromeMock.tabGroups.query.mockResolvedValue([{ id: 1, title: '🧲Jira', windowId: 1 }]);
    chromeMock.tabGroups.move.mockRejectedValue(new Error('Move failed'));

    await maintainTMOrder(1);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to move group 1'));
  });

  test('should do nothing if no TM groups', async () => {
    const { maintainTMOrder } = await import('../projects/app/ui/utils.js');

    chromeMock.storage.local.get.mockResolvedValue({ targets: [{ name: 'Jira' }] });
    chromeMock.tabGroups.query.mockResolvedValue([{ id: 1, title: 'Regular', windowId: 1 }]);

    await maintainTMOrder(1);

    expect(chromeMock.tabGroups.move).not.toHaveBeenCalled();
  });
});
