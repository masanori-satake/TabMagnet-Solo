import { jest } from '@jest/globals';
import { state, loadState, saveGroupSets, saveSettings } from '../projects/app/ui/state.js';
import { DEFAULT_SETTINGS, createDefaultGroupSet } from '../projects/app/ui/utils.js';

/**
 * キーとJSON値を合わせたUTF-8サイズが指定値になる有効な同期データを作る。
 * @param {number} bytes - 項目のバイト数
 * @returns {Array} 境界値検証用のGroup-Set配列
 */
function groupSetsWithBytes(bytes) {
  const patterns = Array(20).fill('x');
  const groupSets = [{
    name: 'Set', color: 'grey', expanded: true,
    groups: [{ name: 'Group', pattern: patterns }]
  }];
  let remaining = bytes - Buffer.byteLength('groupSets' + JSON.stringify(groupSets), 'utf8');
  for (let i = 0; i < patterns.length && remaining > 0; i++) {
    const length = Math.min(499, remaining);
    patterns[i] += 'a'.repeat(length);
    remaining -= length;
  }
  return groupSets;
}

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
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({})
        }
      },
      i18n: {
        getMessage: jest.fn(() => '(名称未設定)')
      }
    };
    global.chrome = chromeMock;
    document.body.innerHTML = '<div id="toast"></div>';

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

  test.each([8191, 8192, 8193])('同期容量の境界をキー込みのバイト数で検証する: %i', async (bytes) => {
    state.settings.syncEnabled = true;
    const groupSets = groupSetsWithBytes(bytes);
    expect(Buffer.byteLength('groupSets' + JSON.stringify(groupSets), 'utf8')).toBe(bytes);

    await saveGroupSets(groupSets);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets });
    if (bytes <= 8192) {
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({ groupSets });
    } else {
      expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
      expect(chromeMock.i18n.getMessage).toHaveBeenCalledWith('errorSyncSizeLimit', ['8192']);
      expect(document.getElementById('toast').classList.contains('show')).toBe(true);
    }
  });

  test.each(['あ', '"', '\\'])('JSONのエスケープとUTF-8の実サイズで同期を制限する: %s', async (character) => {
    state.settings.syncEnabled = true;
    const groupSets = [{
      name: 'Set', color: 'grey', expanded: true,
      groups: [{ name: 'Group', pattern: Array(10).fill(character.repeat(490)) }]
    }];

    await saveGroupSets(groupSets);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets });
    expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
    expect(chromeMock.i18n.getMessage).toHaveBeenCalledWith('errorSyncSizeLimit', ['8192']);
  });

  test('空配列の保存はローカルと同期で既定の1件に正規化する', async () => {
    state.settings.syncEnabled = true;

    await saveGroupSets([]);

    const expected = { groupSets: [createDefaultGroupSet()] };
    expect(state.groupSets).toEqual(expected.groupSets);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expected);
    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(expected);
  });

  test.each([
    { groupSets: [] },
    { groupSets: [{ name: 'Confirmed Set', color: 'blue', expanded: true, groups: [] }] }
  ])('保存中に状態が置き換わっても同じ正規化済み配列を同期する: %j', async ({ groupSets }) => {
    state.settings.syncEnabled = true;
    let finishSave;
    chromeMock.storage.local.set.mockReturnValueOnce(new Promise(resolve => { finishSave = resolve; }));

    const saving = saveGroupSets(groupSets);
    const savedGroupSets = chromeMock.storage.local.set.mock.calls[0][0].groupSets;
    expect(savedGroupSets).toEqual(groupSets.length ? groupSets : [createDefaultGroupSet()]);
    const externalGroupSets = [{ name: 'External Set', color: 'grey', expanded: true, groups: [] }];
    state.groupSets = externalGroupSets;

    finishSave();
    expect(await saving).toBe(true);

    expect(chromeMock.storage.sync.set).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.sync.set.mock.calls[0][0].groupSets).toBe(savedGroupSets);
    expect(state.groupSets).toBe(externalGroupSets);
  });

  test('ロード時の同期でも空の新形式を旧形式より優先して正規化する', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ settings: { syncEnabled: true } });
    chromeMock.storage.sync.get.mockResolvedValue({
      groupSets: [], targets: [{ name: 'Legacy', pattern: 'legacy.example' }]
    });

    await loadState();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ groupSets: [createDefaultGroupSet()] });
    expect(state.groupSets).toEqual([createDefaultGroupSet()]);
  });
});
