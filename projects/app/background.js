/**
 * TabMagnet-Solo Background Service Worker
 *
 * 役割:
 * 1. 拡張機能起動時のクリーンアップ処理（同一ターゲットによる重複グループの解体）
 * 2. ブラウザ起動時の初期化処理
 * 3. 収集完了待ちグループの自動リネーム
 */

const PREFIX_TM = '🧲';
const SUFFIX_COLLECTING = '(Now Collecting)';

/**
 * 拡張機能起動時またはブラウザ起動時に実行
 */
chrome.runtime.onStartup.addListener(async () => {
  await performAutoCleanup();
});

/**
 * インストール/アップデート時にも実行
 */
chrome.runtime.onInstalled.addListener(async () => {
  await performAutoCleanup();

  // アイコンクリック時にサイドパネルを開く設定
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * グループの削除またはタイトル変更を監視
 */
chrome.tabGroups.onRemoved.addListener(async () => {
  await checkAndRenameCollectingGroups();
});

chrome.tabGroups.onUpdated.addListener(async (group) => {
  // タイトルが変更された場合にチェック（解体や手動変更を想定）
  await checkAndRenameCollectingGroups();
});

/**
 * 全ウィンドウを走査し、同一ターゲットによる重複グループをクリーンアップする
 */
async function performAutoCleanup() {
  console.log('Starting auto-cleanup...');
  const settings = await chrome.storage.local.get(['targets', 'protectedGroups']);
  const targets = settings.targets || [];
  const protectedGroups = settings.protectedGroups || [];

  if (targets.length === 0) return;

  const groups = await chrome.tabGroups.query({});

  for (const target of targets) {
    const targetName = target.name;
    // 同一ターゲット名を持つグループを抽出（保護されたグループは除外）
    const matchingGroups = groups.filter(g => {
      if (!g.title) return false;
      const isTargetGroup = (g.title === PREFIX_TM + targetName || g.title === PREFIX_TM + targetName + SUFFIX_COLLECTING);
      const isProtected = protectedGroups.includes(g.title);
      return isTargetGroup && !isProtected;
    });

    if (matchingGroups.length <= 1) continue;

    // 全てを解体対象にする（基本1つのはずだが、複数あれば全て解体して次回のMagnet実行に委ねる）
    // あるいは、Now Collectingでない方を優先して残すなどのロジックも考えられるが、
    // 重複が発生している異常系なので、安全に全解除するのがシンプル。
    for (const group of matchingGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      if (tabs.length > 0) {
        await chrome.tabs.ungroup(tabs.map(t => t.id));
      }
    }
  }
  console.log('Auto-cleanup completed.');
}

/**
 * "(Now Collecting)" 状態のグループを、条件を満たしていれば正規名称にリネームする
 */
async function checkAndRenameCollectingGroups() {
  const groups = await chrome.tabGroups.query({});
  const collectingGroups = groups.filter(g =>
    g.title && g.title.startsWith(PREFIX_TM) && g.title.endsWith(SUFFIX_COLLECTING)
  );

  if (collectingGroups.length === 0) return;

  for (const group of collectingGroups) {
    const finalName = group.title.replace(SUFFIX_COLLECTING, '');

    // 同一ターゲットの正規グループが他に存在しないか確認
    const hasConflict = groups.some(g => g.id !== group.id && g.title === finalName);

    if (!hasConflict) {
      try {
        await chrome.tabGroups.update(group.id, { title: finalName });
        console.log(`Auto-finalized group: ${group.title} -> ${finalName}`);
      } catch (e) {
        console.error(`Failed to finalize group ${group.id}:`, e);
      }
    }
  }
}
