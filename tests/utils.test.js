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

  test('normalization test', () => {
    expect(matchUrl('https://example.com/path', 'https://example.com/*')).toBe(true);
    expect(matchUrl('https://example.com/path', 'http://example.com/*')).toBe(true);
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

});
