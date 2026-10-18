import { DEFAULT_SETTINGS, syncFromCloudIfNeeded, resolveGroupSets, normalizeGroupSets } from './utils.js';
import { showToast } from './toast.js';

const SYNC_QUOTA_BYTES_PER_ITEM = 8192;

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
 * シリアライズ後のキーと値のUTF-8バイト数を検査して同期する。
 * 上限は項目単位のため、全項目を検査してから一度だけ書き込む。
 * @param {Object} data - 同期するデータ
 * @returns {Promise<boolean>} 同期が成功した場合はtrue
 */
export async function syncDataToCloud(data) {
  const exceedsQuota = Object.entries(data).some(([key, value]) =>
    new Blob([key, JSON.stringify(value)]).size > SYNC_QUOTA_BYTES_PER_ITEM);
  if (exceedsQuota) {
    showToast(chrome.i18n.getMessage('errorSyncSizeLimit', [String(SYNC_QUOTA_BYTES_PER_ITEM)]));
    return false;
  }
  try {
    await chrome.storage.sync.set(data);
    return true;
  } catch (e) {
    console.warn('Failed to sync data to chrome.storage.sync:', e);
    return false;
  }
}

/**
 * グループセットリストをストレージに保存する
 * @param {Array} groupSets - 保存するグループセットの配列
 * @param {Object} [options] - 保存オプション
 * @param {boolean} [options.sync=true] - 同期先にも保存するか
 * @returns {Promise<boolean>} 同期が不要、または成功した場合はtrue
 */
export async function saveGroupSets(groupSets, { sync = true } = {}) {
  // この保存では呼び出し時の値を採用し、待機中の外部更新を同期内容に混在させない。
  // 外部更新で置き換わった表示用のstateは、保存完了時に巻き戻さない。
  const savedGroupSets = normalizeGroupSets(groupSets);
  state.groupSets = savedGroupSets;
  await chrome.storage.local.set({ groupSets: savedGroupSets });
  if (sync && state.settings.syncEnabled) {
    return syncDataToCloud({ groupSets: savedGroupSets });
  }
  return true;
}

/**
 * 設定をストレージに保存する
 * @param {Object} settings - 保存する設定オブジェクト
 * @param {Object} [options] - 保存オプション
 * @param {boolean} [options.sync=true] - 同期先にも保存するか
 */
export async function saveSettings(settings, { sync = true } = {}) {
  state.settings = { ...state.settings, ...settings };
  await chrome.storage.local.set({ settings: state.settings });
  if (sync && state.settings.syncEnabled) {
    await syncDataToCloud({ settings: state.settings });
  }
}
