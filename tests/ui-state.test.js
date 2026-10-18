import { jest } from '@jest/globals';
import { state, loadState, saveGroupSets, saveSettings } from '../projects/app/ui/state.js';
import { DEFAULT_SETTINGS } from '../projects/app/ui/utils.js';

describe('ui/state.js', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn().mockResolvedValue({}),
          remove: jest.fn().mockResolvedValue({})
        },
        sync: {
          get: jest.fn().mockResolvedValue({})
        }
      },
      i18n: {
        getMessage: jest.fn(() => '(名称未設定)')
      }
    };
    global.chrome = chromeMock;

    // Reset state
    state.groupSets = [];
    state.settings = { ...DEFAULT_SETTINGS };
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('loadState loads groupSets from storage', async () => {
    const mockGroupSets = [{ name: 'Test Set', color: 'grey', expanded: true, groups: [] }];
    const mockSettings = { keepTMOrder: true };
    chromeMock.storage.local.get.mockResolvedValue({
      groupSets: mockGroupSets,
      settings: mockSettings
    });

    await loadState();

    expect(state.groupSets).toEqual(mockGroupSets);
    expect(state.settings.keepTMOrder).toBe(true);
  });

  test('loadState migrates old targets if groupSets is not present', async () => {
    const mockTargets = [{ name: 'Google', pattern: 'google.com', color: 'blue' }];
    chromeMock.storage.local.get.mockResolvedValue({
      targets: mockTargets,
      settings: {}
    });

    await loadState();

    expect(state.groupSets.length).toBe(1);
    expect(state.groupSets[0].groups[0].name).toBe('Google');
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets: state.groupSets });
    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('targets');
  });

  test('Property 1: saveGroupSets and loadState roundtrip', async () => {
    const originalGroupSets = [{
      name: 'Roundtrip Set',
      color: 'blue',
      expanded: false,
      groups: [{ name: 'Item', pattern: ['item.com/*'], color: 'red' }]
    }];
    const originalSettings = { collapseAfterCollect: true };

    let storedData = {};
    chromeMock.storage.local.set.mockImplementation(async (data) => {
      storedData = { ...storedData, ...data };
    });
    chromeMock.storage.local.get.mockImplementation(async () => storedData);

    await saveGroupSets(originalGroupSets);
    await saveSettings(originalSettings);

    await loadState();

    expect(state.groupSets).toEqual(originalGroupSets);
    expect(state.settings.collapseAfterCollect).toBe(true);
  });

  test('Property 12: migration preserves local syncEnabled flag', async () => {
    const localSettings = { syncEnabled: true };
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'OldTarget', pattern: 'old.com' }],
      settings: localSettings
    });

    await loadState();

    expect(state.settings.syncEnabled).toBe(true);
  });
});
