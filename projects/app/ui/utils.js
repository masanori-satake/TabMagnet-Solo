import {
  PREFIX_TM,
  SUFFIX_COLLECTING,
  COLORS_CHROME,
  COLORS_EDGE,
  ALL_COLORS,
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
  keepTMOrder: false,
  syncEnabled: false
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
 * URLからプロトコル（http/https）と末尾スラッシュを除去して正規化する
 * @param {string} str - 対象URL文字列
 * @returns {string} 正規化済み文字列
 */
const normalizeUrl = (str) => str.replace(/^https?:\/\//, '').replace(/\/$/, '');

// パターンを照合するためのリテラル部分のキャッシュ
const patternPartsCache = new Map();
const MAX_PATTERN_PARTS_CACHE_SIZE = 500;

/**
 * 連続するワイルドカードを1つに統合する
 * 正規表現を使わずに処理し、パターンの長さに比例した時間で完了させる。
 *
 * @param {string} pattern ユーザー定義のパターン
 * @returns {string} 連続するワイルドカードを統合したパターン
 */
function collapseWildcards(pattern) {
  let collapsedPattern = '';
  let previousWasWildcard = false;

  for (const character of pattern) {
    if (character !== '*' || !previousWasWildcard) {
      collapsedPattern += character;
    }
    previousWasWildcard = character === '*';
  }

  return collapsedPattern;
}

/**
 * URLパターンのリテラル部分を取得（または生成してキャッシュ）する
 * ワイルドカードを区切りとして扱うことで、正規表現のバックトラッキングを発生させずに照合できる。
 *
 * @param {string} pattern ユーザー定義のパターン
 * @returns {string[]} ワイルドカードで分割したリテラル部分
 */
function getPatternParts(pattern) {
  let parts = patternPartsCache.get(pattern);
  if (!parts) {
    if (patternPartsCache.size >= MAX_PATTERN_PARTS_CACHE_SIZE) {
      patternPartsCache.clear();
    }
    const normalizedPattern = normalizeUrl(pattern);
    const collapsedPattern = collapseWildcards(normalizedPattern);

    // 末尾の "/*" はドメイン単体にもマッチする従来仕様を維持する
    const matchPattern = collapsedPattern.endsWith('/*')
      ? collapsedPattern.slice(0, -2)
      : collapsedPattern;

    parts = matchPattern.split('*');
    patternPartsCache.set(pattern, parts);
  }
  return parts;
}

/**
 * ワイルドカードで分割されたリテラル部分とURLの前方一致を判定する
 *
 * @param {string} url 正規化済みのURL文字列
 * @param {string[]} parts ワイルドカードで分割したリテラル部分
 * @returns {boolean} リテラル部分がワイルドカードの順序で一致する場合はtrue
 */
function matchesPatternParts(url, parts) {
  let searchStart = 0;

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part) continue;

    if (index === 0) {
      if (!url.startsWith(part)) return false;
      searchStart = part.length;
      continue;
    }

    const partIndex = url.indexOf(part, searchStart);
    if (partIndex === -1) return false;
    searchStart = partIndex + part.length;
  }

  return true;
}

/**
 * URLパターンがマッチするか判定する
 *
 * 仕様:
 * - 前方一致
 * - "*" によるワイルドカード（途中または末尾）をサポート
 * - "http://" や "https://" は含まなくてもマッチするように扱う
 *
 * @param {string} url 判定対象のURL（または事前に正規化済みのURL文字列）
 * @param {string} pattern ユーザー定義のパターン
 * @returns {boolean} マッチした場合はtrue
 */
export function matchUrl(url, pattern) {
  if (!url || !pattern) return false;

  const normalizedUrl = normalizeUrl(url);
  return matchesPatternParts(normalizedUrl, getPatternParts(pattern));
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

const ALLOWED_IMPORT_PROPERTIES = new Set(['targets', 'settings']);
const ALLOWED_TARGET_PROPERTIES = new Set(['name', 'pattern', 'color']);
const ALLOWED_SETTINGS_PROPERTIES = new Set(Object.keys(DEFAULT_SETTINGS));
const ALLOWED_TARGET_COLORS = new Set([...ALL_COLORS, ...Object.keys(COLOR_COMPATIBILITY_MAP)]);
const MAX_TARGET_COLOR_LENGTH = 20;

/**
 * オブジェクトが許可されたプロパティだけを持つことを確認する
 */
function validateAllowedProperties(value, allowedProperties, errorMessage) {
  if (Object.keys(value).some(key => !allowedProperties.has(key))) {
    throw new Error(errorMessage);
  }
}

/**
 * インポート・同期データの構造・型・入力長を検証する
 */
export function validateImportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid format');
  }
  validateAllowedProperties(data, ALLOWED_IMPORT_PROPERTIES, 'Invalid import property');

  if (data.targets !== undefined) {
    if (!Array.isArray(data.targets)) {
      throw new Error('Invalid format: targets must be an array');
    }
    if (data.targets.length > 100) {
      throw new Error('Invalid format: targets array exceeds limit');
    }

    for (const target of data.targets) {
      if (!target || typeof target !== 'object' || Array.isArray(target)) {
        throw new Error('Invalid target element');
      }
      validateAllowedProperties(target, ALLOWED_TARGET_PROPERTIES, 'Invalid target property');
      if (typeof target.name !== 'string' || target.name.trim() === '' || target.name.length > 100) {
        throw new Error('Invalid target name');
      }
      const isPatternStringValid = typeof target.pattern === 'string' &&
        target.pattern.trim() !== '' &&
        target.pattern.length <= 500;
      const isPatternArrayValid = Array.isArray(target.pattern) &&
        target.pattern.length > 0 &&
        target.pattern.length <= 50 &&
        target.pattern.every(p => typeof p === 'string' && p.trim() !== '' && p.length <= 500);

      if (!isPatternStringValid && !isPatternArrayValid) {
        throw new Error('Invalid target pattern');
      }
      if (Object.prototype.hasOwnProperty.call(target, 'color') &&
          (typeof target.color !== 'string' || target.color.trim() === '' ||
           target.color.length > MAX_TARGET_COLOR_LENGTH || !ALLOWED_TARGET_COLORS.has(target.color))) {
        throw new Error('Invalid target color');
      }
    }
  }

  if (data.settings !== undefined) {
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      throw new Error('Invalid settings');
    }
    validateAllowedProperties(data.settings, ALLOWED_SETTINGS_PROPERTIES, 'Invalid settings property');
    if (Object.values(data.settings).some(value => typeof value !== 'boolean')) {
      throw new Error('Invalid settings value');
    }
  }
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
export function executeMagnet(target, options = {}) {
  const currentTask = executionQueue.then(() => _executeMagnetInternal(target, options));
  // 次のタスクのために、エラーが発生してもキューが止まらないようにする
  executionQueue = currentTask.catch(() => {});
  return currentTask;
}

/**
 * 登録されているすべてのターゲットに対して一括でタブを集約（Magnet All発動）する
 * 途中のターゲットごとの再整列はスキップし、最後に一度だけ再整列を行う
 *
 * @param {Array<Object>} targets ターゲット設定の配列
 */
export function executeAllMagnets(targets) {
  const currentTask = executionQueue.then(async () => {
    for (const target of targets) {
      await _executeMagnetInternal(target, { skipMaintainTMOrder: true });
    }
    const currentWindow = await chrome.windows.getCurrent();
    await maintainTMOrder(currentWindow.id);
  });
  executionQueue = currentTask.catch(() => {});
  return currentTask;
}

/**
 * 実際の磁石処理の内部実装
 * @param {Object} target
 * @param {Object} [options]
 * @param {boolean} [options.skipMaintainTMOrder]
 */
async function _executeMagnetInternal(target, options = {}) {
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
    // パフォーマンス最適化: 各タブにつき URL の正規化とキャッシュ済みパターンの照合を効率的に実行
    if (!tab.url) continue;
    const normUrl = normalizeUrl(tab.url);
    const isMatched = patterns.some(p => p && matchesPatternParts(normUrl, getPatternParts(p)));

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
  if (settings.keepTMOrder && !options.skipMaintainTMOrder) {
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
 * 端末間同期が有効な場合、クラウド(chrome.storage.sync)から最新データを取得して
 * ローカルストレージ(chrome.storage.local)に反映する
 * (端末間同期のON/OFFフラグ syncEnabled はローカル端末の値を保持する)
 */
export async function syncFromCloudIfNeeded() {
  try {
    const local = await chrome.storage.local.get(['settings']);
    const isSyncEnabled = local.settings?.syncEnabled ?? false;
    if (!isSyncEnabled) return;

    const syncData = await chrome.storage.sync.get(['settings', 'targets']);
    validateImportData(syncData);

    const updates = {};
    const keysToRemove = [];

    if (syncData.targets === undefined) {
      keysToRemove.push('targets');
    } else {
      updates.targets = syncData.targets;
    }

    if (syncData.settings === undefined) {
      keysToRemove.push('settings');
    } else {
      const currentLocalSettings = local.settings || {};
      updates.settings = {
        ...DEFAULT_SETTINGS,
        ...syncData.settings,
        syncEnabled: currentLocalSettings.syncEnabled ?? true
      };
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  } catch (e) {
    console.warn('Failed to sync from cloud:', e);
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
