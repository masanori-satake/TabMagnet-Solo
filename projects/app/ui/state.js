import { DEFAULT_SETTINGS } from './utils.js';

/**
 * アプリケーションのグローバル状態管理
 */
export const state = {
  targets: [],
  settings: { ...DEFAULT_SETTINGS },
  selectedColor: 'grey',
  currentEditIndex: null,
  currentDeleteIndex: null
};

/**
 * ストレージから最新のデータをロードする
 */
export async function loadState() {
  const data = await chrome.storage.local.get(['targets', 'settings']);
  state.targets = data.targets || [];
  state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

/**
 * ターゲットリストをストレージに保存する
 * @param {Array} targets - 保存するターゲットの配列
 */
export async function saveTargets(targets) {
  state.targets = targets;
  await chrome.storage.local.set({ targets: state.targets });
}

/**
 * 設定をストレージに保存する
 * @param {Object} settings - 保存する設定オブジェクト
 */
export async function saveSettings(settings) {
  state.settings = { ...state.settings, ...settings };
  await chrome.storage.local.set({ settings: state.settings });
}
