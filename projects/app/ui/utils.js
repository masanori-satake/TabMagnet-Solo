/**
 * TabMagnet-Solo Core Utilities
 */

/**
 * デフォルト設定
 */
export const DEFAULT_SETTINGS = {
  collectFromAllGroups: false,
  collapseAfterCollect: false,
  discardTabsAfterCollect: false,
  closeDuplicateTabs: false,
  keepTMOrder: false
};

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

let executionQueue = Promise.resolve();

/**
 * 指定されたターゲット設定に基づき、タブを集約（磁石発動）する
 * 同時に複数の処理が走らないよう、キューでシリアルに実行する
 *
 * @param {Object} target ターゲット設定 { name, pattern, color }
 */
export function executeMagnet(target) {
  const currentTask = executionQueue.then(() => _executeMagnetInternal(target));
  // 次のタスクのために、エラーが発生してもキューが止まらないようにする
  executionQueue = currentTask.catch(() => {});
  return currentTask;
}

/**
 * 実際の磁石処理の内部実装
 * @param {Object} target
 */
async function _executeMagnetInternal(target) {
  const currentWindow = await chrome.windows.getCurrent();
  const allTabs = (await chrome.tabs.query({})).sort((a, b) => a.index - b.index);
  const storageData = await chrome.storage.local.get(['settings']);
  const settings = { ...DEFAULT_SETTINGS, ...(storageData.settings || {}) };

  const allGroups = await chrome.tabGroups.query({});
  const groupMap = new Map(allGroups.map(g => [g.id, g]));

  const PREFIX_TM = '🧲';
  const SUFFIX_COLLECTING = ' (Now Collecting)';

  // マッチするタブを抽出（保護されたグループに属するものは除外）
  const matchedTabs = [];
  const groupsToDissolve = new Set();
  const tabsToClose = [];
  const seenUrls = new Set();

  const patterns = Array.isArray(target.pattern) ? target.pattern : [target.pattern];

  for (const tab of allTabs) {
    const isMatched = patterns.some(p => matchUrl(tab.url, p));
    if (!isMatched) continue;

    let isProtected = false;
    let isTMGroup = false;
    let isTargetGroup = false;

    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const group = groupMap.get(tab.groupId);
      if (group && group.title) {
        isTMGroup = group.title.startsWith(PREFIX_TM);
        isProtected = !isTMGroup && !settings.collectFromAllGroups;

        isTargetGroup = (group.title === PREFIX_TM + target.name) ||
                        (group.title === PREFIX_TM + target.name + SUFFIX_COLLECTING);

        if (isTMGroup && isTargetGroup) {
          groupsToDissolve.add(group.id);
        }
      }
    }

    if (isProtected) {
      continue;
    }

    if (settings.closeDuplicateTabs) {
      if (seenUrls.has(tab.url)) {
        tabsToClose.push(tab.id);
        continue;
      }
      seenUrls.add(tab.url);
    }

    matchedTabs.push(tab);
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

  // 重複タブのクローズ
  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose);
  }

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
    // 重複判定にウィンドウIDは問わない（全ウィンドウで唯一の正規グループ名を維持するため）
    if (g.title === finalGroupName) return true;
    if (g.title === tempGroupName && g.id < newGroupId) return true;
    return false;
  });

  if (!hasConflict) {
    try {
      await chrome.tabGroups.update(newGroupId, { title: finalGroupName });
    } catch (e) {
      console.warn(`Failed to update group title: ${e.message}`);
    }
  }

  // 5. メモリ節約設定が有効な場合、タブを破棄（discard）する
  if (settings.collapseAfterCollect && settings.discardTabsAfterCollect) {
    // 最新のタブ状態を取得
    const tabsInNewGroup = await chrome.tabs.query({ groupId: newGroupId });
    const [activeTabInCurrentWindow] = await chrome.tabs.query({ active: true, windowId: currentWindow.id });

    for (const tab of tabsInNewGroup) {
      // 操作中のウィンドウのアクティブタブ以外を破棄対象とする
      if (activeTabInCurrentWindow && tab.id === activeTabInCurrentWindow.id) {
        continue;
      }
      try {
        await chrome.tabs.discard(tab.id);
      } catch (e) {
        console.error(`Failed to discard tab ${tab.id}:`, e);
      }
    }
  }

  // 6. 順序/位置の維持設定が有効な場合、並べ替えを行う
  if (settings.keepTMOrder) {
    await maintainTMOrder(currentWindow.id);
  }
}

/**
 * TabMagnetグループの順序と位置を維持する
 * @param {number} windowId
 */
export async function maintainTMOrder(windowId) {
  const data = await chrome.storage.local.get(['targets']);
  const targets = data.targets || [];
  if (targets.length === 0) return;

  const PREFIX_TM = '🧲';
  const SUFFIX_COLLECTING = ' (Now Collecting)';
  const allGroups = await chrome.tabGroups.query({ windowId });
  const groupMap = new Map(allGroups.map(g => [g.id, g]));

  // ウィンドウ内の全タブを一度だけ取得し、インデックス順にソートしてグループごとに分類
  const allTabs = (await chrome.tabs.query({ windowId })).sort((a, b) => a.index - b.index);
  const tabsByGroup = new Map();
  for (const tab of allTabs) {
    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) continue;
    if (!tabsByGroup.has(tab.groupId)) {
      tabsByGroup.set(tab.groupId, []);
    }
    tabsByGroup.get(tab.groupId).push(tab);
  }

  // 有効なTabMagnetグループのみを抽出（タブが1つ以上含まれるものに限定）
  const tmGroups = allGroups.filter(g => {
    if (!g.title || !g.title.startsWith(PREFIX_TM)) return false;
    const tabs = tabsByGroup.get(g.id);
    return tabs && tabs.length > 0;
  });

  if (tmGroups.length === 0) return;

  // ターゲットリストの順序に従って、存在するグループの情報（最小インデックスとタブリスト）を抽出
  const groupOrderInfo = [];
  for (const target of targets) {
    // 複数のグループがヒットする場合に備え、filterして有効なものを選ぶ
    const matchedGroups = tmGroups.filter(g => g.title === PREFIX_TM + target.name || g.title === PREFIX_TM + target.name + SUFFIX_COLLECTING);
    if (matchedGroups.length > 0) {
      // 複数の場合は、基本的に Collecting ではない方を優先するか、IDが新しい方を採用する
      const group = matchedGroups.length === 1 ? matchedGroups[0] : matchedGroups.sort((a, b) => b.id - a.id)[0];
      const tabs = tabsByGroup.get(group.id);
      const minIndex = tabs[0].index; // ソート済みなので[0]が最小
      groupOrderInfo.push({ id: group.id, minIndex, tabs });
    }
  }

  if (groupOrderInfo.length === 0) return;

  // 既に正しい順序で最後尾に並んでいるかチェック
  let isCorrect = true;
  const totalTMTabs = groupOrderInfo.reduce((sum, info) => sum + info.tabs.length, 0);
  let currentPos = allTabs.length - totalTMTabs;

  for (const info of groupOrderInfo) {
    if (info.minIndex !== currentPos) {
      isCorrect = false;
      break;
    }
    currentPos += info.tabs.length;
  }

  if (!isCorrect) {
    // ターゲット順に正しい絶対インデックスへ移動させる
    // ターゲットリストにないTabMagnetグループ（手動作成や保護されていないもの）を考慮し、
    // 現在ウィンドウ内にあるTabMagnetグループ以外のタブの末尾を起点とする。
    const nonTMTabs = allTabs.filter(t => {
      if (t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return true;
      const group = groupMap.get(t.groupId);
      return !group || !group.title || !group.title.startsWith(PREFIX_TM);
    });

    let currentTargetIndex = nonTMTabs.length;
    for (const info of groupOrderInfo) {
      // chrome.tabGroups.move を使うと、そのグループ内の全タブが指定インデックス以降に移動する
      await chrome.tabGroups.move(info.id, { index: currentTargetIndex });
      currentTargetIndex += info.tabs.length;
    }
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
