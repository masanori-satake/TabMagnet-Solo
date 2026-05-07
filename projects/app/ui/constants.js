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
 * Chromium API で正式にサポートされているタブグループのカラー（全9色）
 */
export const ALL_COLORS = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'
];

/**
 * ChromeのUIで一般的に選択可能なカラー（9色）
 */
export const COLORS_CHROME = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'
];

/**
 * EdgeのUIで選択可能なカラー（9色）
 * API上はChromeと同じキーを使用するが、UI上の並び順と見た目が異なる。
 * 並び順: 青, ピンク, 紫, 紫(赤紫), 紺青色, 青緑, オレンジ, 黄色, 灰色
 */
export const COLORS_EDGE = [
  'blue', 'pink', 'purple', 'red', 'cyan', 'green', 'orange', 'yellow', 'grey'
];

/**
 * ブラウザ間のカラー互換性マッピング
 * APIレベルで同一の9色を使用するため、実質的な「変換」は不要だが、
 * 以前のバージョン（1.6.0暫定版）で保存された可能性がある非標準色を救済するために定義。
 */
export const COLOR_COMPATIBILITY_MAP = {
  'magenta': 'red',
  'teal': 'green',
  'brown': 'orange',
  'white': 'grey',
  'black': 'grey'
};
