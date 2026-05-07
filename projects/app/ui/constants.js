/**
 * 拡張機能全体で使用される定数
 */

/**
 * TabMagnetグループを示すプレフィックス（磁石絵文字）
 */
export const PREFIX_TM = '🧲';

/**
 * 収集中のグループに付与されるサフィックス
 * 前方に半角スペースを含む
 */
export const SUFFIX_COLLECTING = ' (Now Collecting)';

/**
 * Chromiumでサポートされているタブグループのカラー（全14色）
 */
export const ALL_COLORS = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
  'white', 'black', 'brown', 'magenta', 'teal'
];

/**
 * ChromeのUIで一般的に選択可能なカラー（9色）
 */
export const COLORS_CHROME = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'
];

/**
 * EdgeのUIで一般的に選択可能なカラー（9色）
 * ユーザーフィードバックに基づくマッピング：
 * 灰色(grey), 青(blue), 黄色(yellow), ピンク(pink), 紫(purple),
 * 紫/赤紫(magenta), 紺青色(cyan?), 青緑(teal), オレンジ(orange)
 */
export const COLORS_EDGE = [
  'grey', 'blue', 'yellow', 'pink', 'purple', 'magenta', 'cyan', 'teal', 'orange'
];

/**
 * ブラウザ間のカラー互換性マッピング
 * 相手側のUIに存在しない色を、最も近い色に変換する
 */
export const COLOR_COMPATIBILITY_MAP = {
  // Chrome -> Edge
  'red': 'magenta',
  'green': 'teal',
  // Edge -> Chrome
  'magenta': 'red',
  'teal': 'green',
  // その他(Edge固有等) -> Chrome/Default
  'brown': 'orange',
  'white': 'grey',
  'black': 'grey'
};
