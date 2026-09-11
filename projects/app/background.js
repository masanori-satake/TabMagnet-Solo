/**
 * TabMagnet-Solo Background Service Worker
 *
 * 役割:
 * 1. 拡張機能起動時のクリーンアップ処理
 * 2. ブラウザ起動時の初期化処理
 * 3. 収集完了待ちグループの自動リネーム
 */
import { checkAndRenameCollectingGroups, performAutoCleanup, syncFromCloudIfNeeded, DEFAULT_SETTINGS, validateImportData } from './ui/utils.js';

/**
 * 拡張機能起動時またはブラウザ起動時に実行
 */
chrome.runtime.onStartup.addListener(async () => {
  await syncFromCloudIfNeeded();
  await performAutoCleanup();
});

/**
 * インストール/アップデート時にも実行
 */
chrome.runtime.onInstalled.addListener(async () => {
  await syncFromCloudIfNeeded();
  await performAutoCleanup();

  // アイコンクリック時にサイドパネルを開く設定
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * ストレージ変更の監視（端末間同期のバックグラウンド反映）
 */
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync') {
    const local = await chrome.storage.local.get(['settings']);
    const isSyncEnabled = local.settings?.syncEnabled ?? false;
    if (!isSyncEnabled) return;

    try {
      const syncData = {};
      if (changes.targets) syncData.targets = changes.targets.newValue;
      if (changes.settings) syncData.settings = changes.settings.newValue;
      validateImportData(syncData);
    } catch (e) {
      console.warn('Invalid sync data received:', e);
      return;
    }

    const updates = {};
    const keysToRemove = [];
    if (changes.targets) {
      if (changes.targets.newValue === undefined) {
        keysToRemove.push('targets');
      } else {
        updates.targets = changes.targets.newValue;
      }
    }
    if (changes.settings) {
      if (changes.settings.newValue === undefined) {
        keysToRemove.push('settings');
      } else {
        const currentLocalSettings = local.settings || {};
        updates.settings = {
          ...DEFAULT_SETTINGS,
          ...changes.settings.newValue,
          syncEnabled: currentLocalSettings.syncEnabled ?? true
        };
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  }
});

/**
 * グループの削除またはタイトル変更を監視
 */
chrome.tabGroups.onRemoved.addListener(async () => {
  await checkAndRenameCollectingGroups();
});

chrome.tabGroups.onUpdated.addListener(async () => {
  // タイトルが変更された場合にチェック
  await checkAndRenameCollectingGroups();
});

// テスト用にエクスポート（ESM環境でのテスト用）
export { checkAndRenameCollectingGroups, performAutoCleanup };
