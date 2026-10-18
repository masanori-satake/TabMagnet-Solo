import { DEFAULT_SETTINGS, syncFromCloudIfNeeded, resolveGroupSets } from './utils.js';

/**
 * アプリケーションのグローバル状態管理
 */
export const state = {
  groupSets: [],
  settings: { ...DEFAULT_SETTINGS },
  selectedColor: 'grey',
  currentEdit: { setIndex: null, groupIndex: null },
  currentDelete: { type: null, setIndex: null, groupIndex: null },
  currentEditSetIndex: null,
  selectedSetColor: 'grey'
};

/**
 * ストレージから最新のデータをロードする
 */
export async function loadState() {
  await syncFromCloudIfNeeded();
  const rawData = await chrome.storage.local.get(['groupSets', 'targets', 'settings']);
  const resolved = resolveGroupSets(rawData);
  state.groupSets = resolved.groupSets;
  state.settings = { ...DEFAULT_SETTINGS, ...(rawData.settings || {}) };

  if (resolved.migrated) {
    await chrome.storage.local.set({ groupSets: state.groupSets });
    if (resolved.needsCleanup) {
      await chrome.storage.local.remove('targets');
    }
  }
}

/**
 * グループセットリストをストレージに保存する
 * @param {Array} groupSets - 保存するグループセットの配列
 */
export async function saveGroupSets(groupSets) {
  state.groupSets = groupSets;
  await chrome.storage.local.set({ groupSets: state.groupSets });
  if (state.settings.syncEnabled) {
    try {
      await chrome.storage.sync.set({ groupSets: state.groupSets });
    } catch (e) {
      console.warn('Failed to sync groupSets to chrome.storage.sync:', e);
    }
  }
}

/**
 * 設定をストレージに保存する
 * @param {Object} settings - 保存する設定オブジェクト
 */
export async function saveSettings(settings) {
  state.settings = { ...state.settings, ...settings };
  await chrome.storage.local.set({ settings: state.settings });
  if (state.settings.syncEnabled) {
    try {
      await chrome.storage.sync.set({ settings: state.settings });
    } catch (e) {
      console.warn('Failed to sync settings to chrome.storage.sync:', e);
    }
  }
}
