/**
 * TabMagnet-Solo Background Service Worker
 *
 * 役割:
 * 1. 拡張機能起動時のクリーンアップ処理（旧世代グループの解体）
 * 2. ブラウザ起動時の初期化処理
 */

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
 * 全ウィンドウを走査し、旧世代のグループをクリーンアップする
 */
async function performAutoCleanup() {
  console.log('Starting auto-cleanup...');
  const settings = await chrome.storage.local.get(['targets', 'protectedGroups']);
  const targets = settings.targets || [];
  const protectedGroups = settings.protectedGroups || [];

  if (targets.length === 0) return;

  const groups = await chrome.tabGroups.query({});

  const SUFFIX_TM = '_TM';
  const SUFFIX_COLLECTING = '_TM(Now Collecting)';

  for (const target of targets) {
    const targetName = target.name;
    // 同一ターゲット名を持つグループを抽出（保護されたグループは除外）
    // 新仕様では Name_TM または Name_TM(Now Collecting) が対象
    const matchingGroups = groups.filter(g => {
      if (!g.title) return false;
      const isTargetGroup = (g.title === targetName + SUFFIX_TM || g.title === targetName + SUFFIX_COLLECTING);
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
