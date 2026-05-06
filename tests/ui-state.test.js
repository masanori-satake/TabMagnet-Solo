import { jest } from '@jest/globals';
import { state, loadState, saveTargets, saveSettings } from '../projects/app/ui/state.js';
import { DEFAULT_SETTINGS } from '../projects/app/ui/utils.js';

describe('ui/state.js', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn().mockResolvedValue({})
        }
      }
    };
    global.chrome = chromeMock;

    // Reset state
    state.targets = [];
    state.settings = { ...DEFAULT_SETTINGS };
  });

  test('loadState loads data from storage', async () => {
    const mockTargets = [{ name: 'Test' }];
    const mockSettings = { keepTMOrder: true };
    chromeMock.storage.local.get.mockResolvedValue({
      targets: mockTargets,
      settings: mockSettings
    });

    await loadState();

    expect(state.targets).toEqual(mockTargets);
    expect(state.settings.keepTMOrder).toBe(true);
  });

  test('saveTargets updates state and storage', async () => {
    const newTargets = [{ name: 'New' }];
    await saveTargets(newTargets);

    expect(state.targets).toEqual(newTargets);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ targets: newTargets });
  });

  test('saveSettings updates state and storage', async () => {
    const newSettings = { collapseAfterCollect: true };
    await saveSettings(newSettings);

    expect(state.settings.collapseAfterCollect).toBe(true);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      settings: expect.objectContaining({ collapseAfterCollect: true })
    });
  });
});
