import {
  PREFIX_TM,
  SUFFIX_COLLECTING,
  COLORS_CHROME,
  COLORS_EDGE,
  COLOR_COMPATIBILITY_MAP
} from './constants.js';

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
 * 現在のブラウザがMicrosoft Edgeであるか判定する
 * @returns {boolean} Edgeの場合はtrue
 */
export function isEdge() {
  return navigator.userAgent.includes('Edg/');
}

/**
 * 指定された色が現在のブラウザでサポートされているか確認し、
 * サポートされていない場合は代替の色を返す
 * @param {string} color - チェックする色名
 * @returns {string} サポートされている色名
 */
export function getCompatibleColor(color) {
  const supportedColors = isEdge() ? COLORS_EDGE : COLORS_CHROME;
  if (supportedColors.includes(color)) {
    return color;
  }
  // 互換性マッピングを適用
  if (COLOR_COMPATIBILITY_MAP[color]) {
    const mappedColor = COLOR_COMPATIBILITY_MAP[color];
    // マッピング先が現在のブラウザでサポートされているか再帰的に確認（念のため）
    return supportedColors.includes(mappedColor) ? mappedColor : 'grey';
  }
  return 'grey'; // フォールバック
}

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
  const escapedPattern = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  let regexPattern = '^' + escapedPattern.replace(/\*/g, '.*');

  // 末尾が "/*" で終わるパターンの場合、スラッシュなしのドメイン単体にもマッチするように調整
  // 例: "example.com/*" が "example.com" (正規化済み) にもマッチするようにする
  if (normalizedPattern.endsWith('/*')) {
    // 末尾の "/.*" (3文字) を "(/.*)?" に置換
    regexPattern = regexPattern.slice(0, -3) + '(/.*)?';
  }

  const regex = new RegExp(regexPattern);
  return regex.test(normalizedUrl);
}

/**
 * ブラウザの特殊ページ（chrome:// など）かどうかを判定する
 * @param {string} url - 判定対象のURL
 * @returns {boolean} 特殊ページの場合はtrue
 */
export function isSpecialPage(url) {
  if (!url) return true;
  return !url.startsWith('http://') && !url.startsWith('https://');
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
  // タブをウィンドウID、次いでインデックス順にソートして一貫性を確保
  const allTabs = (await chrome.tabs.query({})).sort((a, b) => {
    if (a.windowId !== b.windowId) return a.windowId - b.windowId;
    return a.index - b.index;
  });
  const storageData = await chrome.storage.local.get(['settings']);
  const settings = { ...DEFAULT_SETTINGS, ...(storageData.settings || {}) };

  const allGroups = await chrome.tabGroups.query({});
  const groupMap = new Map(allGroups.map(g => [g.id, g]));

  // マッチするタブを抽出（保護されたグループに属するものは除外）
  const matchedTabs = [];
  const groupsToDissolve = new Set();
  const tabsToClose = [];
  const seenUrls = new Set();

  const patterns = Array.isArray(target.pattern) ? target.pattern : [target.pattern];

  for (const tab of allTabs) {
    const isMatched = patterns.some(p => matchUrl(tab.url, p));

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

    if (!isMatched || isProtected) {
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
    // ブラウザ互換性を考慮して色を設定
    updateData.color = getCompatibleColor(target.color);
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

      // 既に破棄（discard）されている場合はスキップ
      if (tab.discarded) {
        continue;
      }

      try {
        await chrome.tabs.discard(tab.id);
      } catch (e) {
        // 既に破棄されているか、タブが閉じられている等の通常起こりうるケース以外で例外が発生した場合のみ警告する
        console.warn(`Failed to discard tab ${tab.id}: ${e.message}`);
      }
    }
  }

  // 6. 順序/位置の維持設定が有効な場合、並べ替えを行う
  if (settings.keepTMOrder) {
    await maintainTMOrder(currentWindow.id);
  }
}

/**
 * "(Now Collecting)" 状態のグループを、条件を満たしていれば正規名称にリネームする
 */
export async function checkAndRenameCollectingGroups() {
  const groupsBefore = await chrome.tabGroups.query({});
  const collectingGroups = groupsBefore.filter(g =>
    g.title && g.title.startsWith(PREFIX_TM) && g.title.endsWith(SUFFIX_COLLECTING)
  );

  if (collectingGroups.length === 0) return;

  for (const group of collectingGroups) {
    // 競合チェックを最新の状態で行うため、ループ内で再取得
    const currentGroups = await chrome.tabGroups.query({});
    const finalName = group.title.replace(SUFFIX_COLLECTING, '');

    // 同一ターゲットの正規グループ、または自分よりIDの小さい同名Collectingグループが存在しないか確認
    // (複数Collectingがある場合、一番IDが小さいものだけを正規化対象にする)
    const hasConflict = currentGroups.some(g => {
      if (g.id === group.id) return false;
      // すでに正規名称のグループがある場合
      if (g.title === finalName) return true;
      // 自分と同じCollecting名称で、かつ自分より先に作られた(IDが小さい)ものがある場合
      if (g.title === group.title && g.id < group.id) return true;
      return false;
    });

    if (!hasConflict) {
      try {
        await chrome.tabGroups.update(group.id, { title: finalName });
      } catch (e) {
        console.warn(`Failed to finalize group ${group.id}: ${e.message}`);
      }
    }
  }
}

/**
 * 重複するターゲットグループのクリーンアップ
 */
export async function performAutoCleanup() {
  const data = await chrome.storage.local.get(['targets', 'protectedGroups']);
  const targets = data.targets || [];
  const protectedGroups = data.protectedGroups || [];

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

    // 全てを解体対象にする
    await dissolveGroups(matchingGroups.map(g => g.id));
  }
}

/**
 * TabMagnetグループの順序と位置を維持する
 *
 * ウィンドウ内の全TabMagnetグループ（🧲で始まるもの）を最後尾に並べ替え、
 * さらにターゲットリストの定義順に従って整列させる。
 *
 * 確実性を高めるため、グループ単位（chrome.tabGroups.move）で
 * 一つずつ最後尾（index: -1）へ移動させる方式を採用。
 * 1. ターゲットリストに含まれない孤立したTMグループを先に最後尾へ移動
 * 2. ターゲットリストに含まれるTMグループを、リストの順序に従って最後尾へ移動
 * これにより、最終的にターゲットリスト順がウィンドウの末尾に確定する。
 *
 * @param {number} windowId
 */
export async function maintainTMOrder(windowId) {
  const data = await chrome.storage.local.get(['targets']);
  const targets = data.targets || [];

  const allGroups = await chrome.tabGroups.query({ windowId });

  // 全てのTabMagnetグループを特定
  const tmGroups = allGroups.filter(g => g.title && g.title.startsWith(PREFIX_TM));
  if (tmGroups.length === 0) return;

  const movedGroupIds = new Set();
  const orderedGroupIds = [];

  // 1. ターゲットリストに合致するグループ（重複含む）を順序通りに収集
  for (const target of targets) {
    const finalName = PREFIX_TM + target.name;
    const collectingName = finalName + SUFFIX_COLLECTING;

    // 同名グループ（正規・収集中）をすべて抽出
    const matchedGroups = tmGroups.filter(g => g.title === finalName || g.title === collectingName);

    if (matchedGroups.length > 0) {
      // 複数の同名グループがある場合、Collectingではない（正規）方を優先し、さらにIDが古い順に並べる
      // (最後尾に送るループのため、優先度の低いものを先に並べる)
      const sorted = matchedGroups.sort((a, b) => {
        const aIsColl = a.title.endsWith(SUFFIX_COLLECTING);
        const bIsColl = b.title.endsWith(SUFFIX_COLLECTING);
        if (aIsColl !== bIsColl) return aIsColl ? -1 : 1; // Collectingを先（＝先に移動させ、正規を後に移動させて後ろにする）
        return a.id - b.id; // 古いIDを先
      });

      for (const g of sorted) {
        orderedGroupIds.push(g.id);
        movedGroupIds.add(g.id);
      }
    }
  }

  // 2. ターゲットリストに含まれない「孤立したTMグループ」を特定
  const orphanGroupIds = tmGroups
    .filter(g => !movedGroupIds.has(g.id))
    .map(g => g.id);

  // 移動の実行
  // まず孤立グループを最後尾へ、次にターゲットグループを順に最後尾へ。
  // これにより、[非TMタブ] [孤立TMグループ] [ターゲットTM1] [ターゲットTM2] ... の順になる。
  const allIdsToMove = [...orphanGroupIds, ...orderedGroupIds];

  for (const groupId of allIdsToMove) {
    try {
      await chrome.tabGroups.move(groupId, { index: -1 });
    } catch (e) {
      console.warn(`Failed to move group ${groupId}: ${e.message}`);
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
