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

  for (const target of targets) {
    const targetName = target.name;
    // 同一ターゲット名を持つグループを抽出（保護されたグループは除外）
    const matchingGroups = groups.filter(g => {
      return g.title &&
             g.title.startsWith(`${targetName}_`) &&
             !protectedGroups.includes(g.title);
    });

    if (matchingGroups.length <= 1) continue;

    // タイムスタンプ部分でソートして最新以外を解体
    // 命名規則: Name_YYYYMMDD_HHMMSS
    matchingGroups.sort((a, b) => {
      const tsA = a.title.split('_').slice(-2).join('_');
      const tsB = b.title.split('_').slice(-2).join('_');
      return tsB.localeCompare(tsA); // 降順
    });

    // 最新 (index 0) 以外を解体
    const oldGroups = matchingGroups.slice(1);
    for (const oldGroup of oldGroups) {
      const tabs = await chrome.tabs.query({ groupId: oldGroup.id });
      if (tabs.length > 0) {
        await chrome.tabs.ungroup(tabs.map(t => t.id));
      }
    }
  }
  console.log('Auto-cleanup completed.');
}
