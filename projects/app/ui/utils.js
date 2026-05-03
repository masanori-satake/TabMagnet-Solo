/**
 * TabMagnet-Solo Core Utilities
 */

/**
 * URLパターンがマッチするか判定する
 *
 * 仕様:
 * - 前方一致
 * - "*" によるワイルドカード（途中または末尾）をサポート
 * - "http://" や "https://" は含まなくてもマッチするように扱う
 *
 * @param {string} url 判定対象のURL
 * @param {string} pattern ユーザー定義のパターン
 * @returns {boolean} マッチした場合はtrue
 */
export function matchUrl(url, pattern) {
  if (!url || !pattern) return false;

  // プロトコルと末尾のスラッシュを除去して比較しやすくする
  const normalize = (str) => str.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const normalizedUrl = normalize(url);
  const normalizedPattern = normalize(pattern);

  // "*" を正規表現の ".*" に変換して判定
  // エスケープ処理: 正規表現の特殊文字をエスケープ（"*" 以外）
  const escapedPattern = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = '^' + escapedPattern.replace(/\*/g, '.*');
  const regex = new RegExp(regexPattern);

  return regex.test(normalizedUrl);
}

/**
 * 現在のタイムスタンプを YYYYMMDD_HHMMSS 形式で取得する
 *
 * @returns {string} タイムスタンプ文字列
 */
export function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

/**
 * ファイルエクスポート用のタイムスタンプを YYMMDD_hhmm 形式で取得する
 *
 * @returns {string} タイムスタンプ文字列
 */
export function getExportTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const yy = String(now.getFullYear()).slice(-2);
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());

  return `${yy}${mm}${dd}_${hh}${min}`;
}

/**
 * 指定されたターゲット設定に基づき、タブを集約（磁石発動）する
 *
 * @param {Object} target ターゲット設定 { name, pattern, color }
 */
export async function executeMagnet(target) {
  const currentWindow = await chrome.windows.getCurrent();
  const allTabs = await chrome.tabs.query({});
  const storageData = await chrome.storage.local.get(['settings']);
  const settings = {
    collectFromAllGroups: false,
    collapseAfterCollect: false,
    ...(storageData.settings || {})
  };

  const allGroups = await chrome.tabGroups.query({});
  const groupMap = new Map(allGroups.map(g => [g.id, g]));

  const PREFIX_TM = '🧲';
  const SUFFIX_COLLECTING = '(Now Collecting)';

  // マッチするタブを抽出（保護されたグループに属するものは除外）
  const matchedTabs = [];
  const groupsToDissolve = new Set();

  const patterns = Array.isArray(target.pattern) ? target.pattern : [target.pattern];

  for (const tab of allTabs) {
    const isMatched = patterns.some(p => matchUrl(tab.url, p));

    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const group = groupMap.get(tab.groupId);
      if (group && group.title) {
        // 自動保護: 🧲 で始まらないグループは保護（ただし「全タブグループから収集」がONの場合は例外）
        const isTMGroup = group.title.startsWith(PREFIX_TM);

        const isProtected = !isTMGroup && !settings.collectFromAllGroups;

        if (isMatched) {
          if (isProtected) {
            continue; // 保護されているのでスキップ
          }
          matchedTabs.push(tab);
        }

        // 重複グループの特定（解体対象候補）
        // ターゲット名に合致し、かつ内部用マーカーを持つ非保護グループ
        const isTargetGroup = (group.title === PREFIX_TM + target.name) ||
                             (group.title === PREFIX_TM + target.name + SUFFIX_COLLECTING);

        if (isTMGroup && isTargetGroup) {
          groupsToDissolve.add(group.id);
        }
      }
    } else if (isMatched) {
      matchedTabs.push(tab);
    }
  }

  if (matchedTabs.length === 0) {
    // マッチするタブがなくても、対象のグループが存在すれば解体する
    await dissolveGroups(Array.from(groupsToDissolve));
    return;
  }

  // 1. ターゲット外のタブをグループから外す（解体前に実施）
  for (const groupId of groupsToDissolve) {
    const tabsInGroup = await chrome.tabs.query({ groupId });
    const tabsToUngroup = tabsInGroup.filter(t => !patterns.some(p => matchUrl(t.url, p)));
    if (tabsToUngroup.length > 0) {
      await chrome.tabs.ungroup(tabsToUngroup.map(t => t.id));
    }
  }

  // 2. 新しいグループを作成（現在のウィンドウ）
  const tempGroupName = PREFIX_TM + target.name + SUFFIX_COLLECTING;
  const tabIds = matchedTabs.map(t => t.id);

  // タブを現在のウィンドウに移動
  await chrome.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 });

  // グループ化
  const newGroupId = await chrome.tabs.group({ tabIds });
  const updateData = { title: tempGroupName };
  if (target.color) {
    updateData.color = target.color;
  }
  if (settings.collapseAfterCollect) {
    updateData.collapsed = true;
  }
  await chrome.tabGroups.update(newGroupId, updateData);

  // 3. 重複するグループ（新しく作ったもの以外）を解体
  const otherGroupsToDissolve = Array.from(groupsToDissolve).filter(id => id !== newGroupId);
  await dissolveGroups(otherGroupsToDissolve);

  // 4. 収集完了後の名称変更チェック
  // 他のウィンドウに同名の正規グループ、または自分よりIDの小さい同名Collectingグループが存在しないか確認
  const finalGroupName = PREFIX_TM + target.name;
  const allGroupsAfter = await chrome.tabGroups.query({});
  const hasConflict = allGroupsAfter.some(g => {
    if (g.id === newGroupId) return false;
    if (g.title === finalGroupName) return true;
    if (g.title === tempGroupName && g.id < newGroupId) return true;
    return false;
  });

  if (!hasConflict) {
    await chrome.tabGroups.update(newGroupId, { title: finalGroupName });
  }
}

/**
 * グループを解体する（中身をバラバラにする）
 * @param {number[]} groupIds
 */
async function dissolveGroups(groupIds) {
  for (const groupId of groupIds) {
    try {
      const tabs = await chrome.tabs.query({ groupId });
      if (tabs.length > 0) {
        await chrome.tabs.ungroup(tabs.map(t => t.id));
      }
    } catch (e) {
      console.error(`Failed to dissolve group ${groupId}:`, e);
    }
  }
}
